/* ===== SDN-VIGIA — Sincronização entre telas =====
   Funciona entre abas/janelas do MESMO navegador (mesma origem).
   Não depende de rede: a mestra abre as janelas no próprio
   computador e compartilha a janela dos jogadores (projetor,
   segunda tela ou screen-share numa call).

   Dois canais separados:
   1) dispatcher -> jogadores: transmite o estado completo (agentes/missões).
   2) mestre -> dispatcher: envia UMA missão nova pra ser recebida na fila
      (o dispatcher processa e integra ao seu próprio estado). */

const SDN_CHANNEL_NAME = "sdn-vigia-sync";
const SDN_STORAGE_KEY = "sdn-vigia-state";

const sdnChannel = ("BroadcastChannel" in window) ? new BroadcastChannel(SDN_CHANNEL_NAME) : null;

function sdnBroadcastState(state) {
  const payload = JSON.stringify(state);
  if (sdnChannel) {
    try { sdnChannel.postMessage(payload); } catch (e) { /* ignora */ }
  }
  // Fallback / persistência para quem abrir a janela depois do primeiro broadcast.
  try {
    localStorage.setItem(SDN_STORAGE_KEY, payload);
  } catch (e) { /* localStorage indisponível (modo privado etc.) */ }
}

function sdnOnStateUpdate(callback) {
  if (sdnChannel) {
    sdnChannel.addEventListener("message", (e) => {
      try { callback(JSON.parse(e.data)); } catch (err) { /* ignora payload inválido */ }
    });
  }
  window.addEventListener("storage", (e) => {
    if (e.key === SDN_STORAGE_KEY && e.newValue) {
      try { callback(JSON.parse(e.newValue)); } catch (err) { /* ignora */ }
    }
  });
}

function sdnGetLastState() {
  try {
    const raw = localStorage.getItem(SDN_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

// ---------- Canal mestre -> dispatcher (envio de missão avulsa) ----------

const SDN_MESTRE_CHANNEL_NAME = "sdn-vigia-mestre";
const SDN_MESTRE_QUEUE_KEY = "sdn-vigia-mestre-queue";

const sdnMestreChannel = ("BroadcastChannel" in window) ? new BroadcastChannel(SDN_MESTRE_CHANNEL_NAME) : null;

// Chamado pela tela do mestre: envia a missão pro dispatcher.
// Usa BroadcastChannel (entrega imediata, se a janela do dispatcher já
// estiver aberta) E uma fila em localStorage (entrega garantida, o
// dispatcher drena essa fila a cada segundo mesmo que a janela dele
// tenha sido aberta depois do envio).
function sdnSendMissionRequest(missionData) {
  if (sdnMestreChannel) {
    try { sdnMestreChannel.postMessage(JSON.stringify(missionData)); } catch (e) { /* ignora */ }
  }
  try {
    const queue = JSON.parse(localStorage.getItem(SDN_MESTRE_QUEUE_KEY) || "[]");
    queue.push(missionData);
    localStorage.setItem(SDN_MESTRE_QUEUE_KEY, JSON.stringify(queue));
  } catch (e) { /* localStorage indisponível */ }
}

// Chamado pelo dispatcher: escuta chegadas em tempo real via BroadcastChannel.
function sdnOnMissionRequest(callback) {
  if (sdnMestreChannel) {
    sdnMestreChannel.addEventListener("message", (e) => {
      try { callback(JSON.parse(e.data)); } catch (err) { /* ignora payload inválido */ }
    });
  }
}

// Chamado pelo dispatcher a cada tick: esvazia a fila de missões pendentes
// (cobre o caso de a missão ter sido enviada antes desta janela existir).
function sdnDrainMissionQueue() {
  try {
    const raw = localStorage.getItem(SDN_MESTRE_QUEUE_KEY);
    if (!raw) return [];
    const queue = JSON.parse(raw);
    if (queue.length) localStorage.setItem(SDN_MESTRE_QUEUE_KEY, "[]");
    return queue;
  } catch (e) {
    return [];
  }
}

// ---------- Canal de autenticação / presença dos jogadores ----------

const SDN_AUTH_CHANNEL_NAME = "sdn-vigia-auth";

const SDN_AUTH_STORAGE_KEY = "sdn-vigia-auth-state";

// A presença termina por logout explícito, não por inatividade da aba.
// O heartbeat continua atualizando lastSeen, mas não é um requisito para
// manter uma sessão aberta em uma tela que ficou em segundo plano.
const SDN_AUTH_TIMEOUT = Number.POSITIVE_INFINITY;

const SDN_AUTH_HEARTBEAT_INTERVAL = 5000; // heartbeat a cada 5 segundos

const sdnAuthChannel =
  ("BroadcastChannel" in window)
    ? new BroadcastChannel(SDN_AUTH_CHANNEL_NAME)
    : null;


// ============================================================
// ESTADO DE PRESENÇA
// ============================================================

function sdnGetAuthState() {
  try {
    const raw = localStorage.getItem(SDN_AUTH_STORAGE_KEY);

    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error(
      "SDN-VIGIA: erro lendo estado de autenticação:",
      e
    );

    return {};
  }
}


function sdnSaveAuthState(state) {
  try {
    localStorage.setItem(
      SDN_AUTH_STORAGE_KEY,
      JSON.stringify(state)
    );
  } catch (e) {
    console.error(
      "SDN-VIGIA: erro salvando estado de autenticação:",
      e
    );
  }
}


// ============================================================
// EVENTO DE AUTENTICAÇÃO
// ============================================================

function sdnBroadcastAuthEvent(event) {
  if (!sdnAuthChannel) return;

  try {
    sdnAuthChannel.postMessage(
      JSON.stringify(event)
    );
  } catch (e) {
    console.error(
      "SDN-VIGIA: erro enviando evento de autenticação:",
      e
    );
  }
}


// ============================================================
// LOGIN
// ============================================================

function sdnSendLogin(login) {
  if (!login) return;

  const state = sdnGetAuthState();

  state[login] = {
    loggedIn: true,
    lastSeen: Date.now()
  };

  sdnSaveAuthState(state);

  sdnBroadcastAuthEvent({
    type: "agent-login",
    login,
    timestamp: Date.now()
  });
}


// ============================================================
// HEARTBEAT
// ============================================================

function sdnSendAgentHeartbeat(login) {
  if (!login) return;

  const state = sdnGetAuthState();

  const session = state[login];

  // Se não existe sessão, não cria uma nova automaticamente.
  if (!session || !session.loggedIn) {
    return;
  }

  session.lastSeen = Date.now();

  sdnSaveAuthState(state);

  sdnBroadcastAuthEvent({
    type: "agent-heartbeat",
    login,
    timestamp: session.lastSeen
  });
}


// ============================================================
// LOGOUT
// ============================================================

function sdnSendLogout(login) {
  if (!login) return;

  const state = sdnGetAuthState();

  delete state[login];

  sdnSaveAuthState(state);

  sdnBroadcastAuthEvent({
    type: "agent-logout",
    login,
    timestamp: Date.now()
  });
}


// ============================================================
// LISTENER DE AUTENTICAÇÃO
// ============================================================

function sdnOnAuthUpdate(callback) {
  if (typeof callback !== "function") return;

  // Eventos instantâneos via BroadcastChannel
  if (sdnAuthChannel) {
    sdnAuthChannel.addEventListener(
      "message",
      (event) => {
        try {
          const payload =
            typeof event.data === "string"
              ? JSON.parse(event.data)
              : event.data;

          if (!payload || !payload.type) {
            return;
          }

          callback(payload);

        } catch (err) {
          console.error(
            "SDN-VIGIA: payload de autenticação inválido:",
            err
          );
        }
      }
    );
  }

  // Alterações persistidas no localStorage
  window.addEventListener(
    "storage",
    (event) => {
      if (
        event.key !== SDN_AUTH_STORAGE_KEY ||
        !event.newValue
      ) {
        return;
      }

      try {
        const state =
          JSON.parse(event.newValue);

        callback({
          type: "auth-state",
          state
        });

      } catch (err) {
        console.error(
          "SDN-VIGIA: estado de autenticação inválido:",
          err
        );
      }
    }
  );
}


// ============================================================
// LIMPEZA DE SESSÕES EXPIRADAS
// ============================================================

function sdnCleanupExpiredSessions() {
  const state = sdnGetAuthState();

  const now = Date.now();

  const expired = [];

  Object.entries(state).forEach(
    ([login, session]) => {

      if (
        !session ||
        session.loggedIn !== true ||
        session.loggedIn !== true
      ) {
        expired.push(login);

        delete state[login];
      }
    }
  );

  if (expired.length) {
    sdnSaveAuthState(state);
  }

  return expired;
}


// ============================================================
// VERIFICAÇÃO INDIVIDUAL
// ============================================================

function sdnIsAgentLoggedIn(login) {
  if (!login) return false;

  const state = sdnGetAuthState();

  const session = state[login];

  if (
    !session ||
    session.loggedIn !== true
  ) {
    return false;
  }

  return true;
}


// ============================================================
// LISTA DE AGENTES ONLINE
// ============================================================

function sdnGetLoggedInAgents() {
  sdnCleanupExpiredSessions();

  const state = sdnGetAuthState();

  const now = Date.now();

  return Object.entries(state)
    .filter(
      ([, session]) =>
        session &&
        session.loggedIn === true
    )
    .map(([login]) => login);
}
