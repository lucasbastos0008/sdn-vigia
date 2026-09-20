/* ===== SDN-VIGIA — Tela dos Jogadores

   Somente leitura. Recebe o estado transmitido pelo console do
   dispatcher (mesma origem, via BroadcastChannel/localStorage)

   A sessão do jogador é definida pelo login.html.

   Renderiza:
   - mapa tático
   - agentes
   - canal de rádio
   - chamado recebido do Dispatcher

   A tela dos jogadores NÃO possui fila de missões.
*/

(() => {

  "use strict";

  // =========================================================
  // PROTEÇÃO DE ACESSO — JOGADOR
  // =========================================================

  const session = JSON.parse(
    sessionStorage.getItem("sdn-session") || "null"
  );

  if (!session || session.type !== "player") {
    window.location.href = "login.html";
    return;
  }

  // =========================================================
  // UTILITÁRIOS
  // =========================================================

  const $ = (sel) => document.querySelector(sel);

  const pad = (n) => String(n).padStart(2, "0");

  function nowTs() {
    const d = new Date();

    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function initials(name) {
    return String(name || "")
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }

  // =========================================================
  // RELÓGIO
  // =========================================================

  let sessionStartedAt = null;

  function tickClock() {

    const clock = $("#clock");

    if (clock) {
      clock.textContent = nowTs();
    }

    const timer = $("#sessionTimer");
    if (timer) {
      const seconds = sessionStartedAt == null
        ? 0 : Math.max(0, Math.floor((Date.now() - sessionStartedAt) / 1000));
      timer.textContent = `${Math.floor(seconds / 60)}min ${pad(seconds % 60)}s`;
    }
  }

  setInterval(tickClock, 1000);
  tickClock();


  // =========================================================
  // SESSÃO DO JOGADOR
  // =========================================================

  let playerSession = null;

  function loadPlayerSession() {

    try {

      const raw = sessionStorage.getItem("sdn-session");

      if (!raw) {
        return null;
      }

      const session = JSON.parse(raw);

      if (
        !session ||
        session.type !== "player" ||
        !session.agentLogin
      ) {
        return null;
      }

      return session;

    } catch (e) {

      return null;
    }
  }

  function renderPlayerIdentity() {
  const nameEl = $("#playerIdentityName");
  const statusEl = $("#playerIdentityStatus");

  if (!nameEl || !statusEl) return;

  if (!playerSession) {
    nameEl.textContent = "---";
    statusEl.textContent = "OFFLINE";
    statusEl.className = "player-identity-status offline";
    return;
  }

  const agent = (lastState.agents || []).find(
    a => a.login === playerSession.agentLogin
  );

  const name =
    agent?.name ||
    playerSession.agentName ||
    playerSession.agentLogin;

  const status =
    agent
      ? combinedStatus(agent)
      : "offline";

  nameEl.textContent = name;
  statusEl.textContent = statusLabel(status);
  statusEl.className =
    `player-identity-status ${status}`;
}


  function redirectToLogin() {

    window.location.href = "login.html";
  }


  playerSession = loadPlayerSession();


  // =========================================================
// PRESENÇA / HEARTBEAT
// =========================================================

let heartbeatTimer = null;

function startHeartbeat() {
  if (!playerSession) return;

  if (typeof sdnSendAgentHeartbeat !== "function") {
    console.warn(
      "[SDN-VIGIA] sync.js não possui heartbeat."
    );
    return;
  }

  const agentLogin = playerSession.agentLogin;

  // Envia imediatamente.
  sdnSendAgentHeartbeat(agentLogin);

  // Depois mantém a sessão viva.
  heartbeatTimer = setInterval(() => {
    sdnSendAgentHeartbeat(agentLogin);
  }, typeof SDN_AUTH_HEARTBEAT_INTERVAL !== "undefined"
  ? SDN_AUTH_HEARTBEAT_INTERVAL
  : 5000
  );
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && playerSession) {
    sdnSendAgentHeartbeat(playerSession.agentLogin);
  }
});

// =========================================================
// ENCERRAMENTO DA SESSÃO
// =========================================================

async function logoutPlayer() {
  if (!playerSession) {
    redirectToLogin();
    return;
  }

  // Confirm logout on the server before discarding the token locally.
  try {
    const response = await fetch((window.SDN_API_BASE_URL || "/api") + "/Auth/logout", {
      method: "POST", headers: { Authorization: "Bearer " + session.token },
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok && response.status !== 401) throw new Error("Logout recusado.");
  } catch (error) {
    window.alert("Não foi possível sair da rede. Verifique a conexão e tente novamente.");
    return;
  }

  if (typeof sdnSendLogout === "function") {
    sdnSendLogout(playerSession.agentLogin);
  }

  stopHeartbeat();

  sessionStorage.removeItem("sdn-session");

  playerSession = null;

  redirectToLogin();
}


  // =========================================================
  // ESTADO RECEBIDO DO DISPATCHER
  // =========================================================

  let lastState = {

    agents: [],

    missions: [],

    radioEntries: [],

    dispatchPreview: null

  };


  // =========================================================
  // AGENTES / ROSTER
  // =========================================================

  function renderAgents() {
    const list = $("#agentList");
    if (!list) return;

    const agents = lastState.agents || [];

    const agentCount = $("#agentCount");
    if (agentCount) {
      agentCount.textContent = agents.length;
    }

    if (agents.length === 0) {
      list.innerHTML = `
        <li class="empty-state">
          AGUARDANDO CONEXÃO COM O DISPATCHER...
        </li>
      `;
      return;
    }

    list.innerHTML = agents.map((a) => {

      const isCurrentPlayer =
        a.login === playerSession?.agentLogin;

      const status = combinedStatus(a);
      const badgeText = statusLabel(status);

      return `
        <li
          class="roster-card player-roster-card ${isCurrentPlayer ? "current-player" : ""}"
          data-agent-login="${escapeHtml(a.login || "")}"
        >
          <div class="roster-card-status ${status}">
            ${badgeText}
          </div>

          ${
            a.foto
              ? `
                <img
                  class="roster-card-photo"
                  src="${escapeHtml(a.foto)}"
                  alt="${escapeHtml(a.name)}"
                  draggable="false"
                >
              `
              : `
                <div
                  class="roster-card-photo"
                  style="
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    color:var(--green);
                    font-size:20px;
                  "
                >
                  ${initials(a.name)}
                </div>
              `
          }

          <div class="roster-card-name">
            ${escapeHtml(a.name)}
          </div>
          <button type="button" class="secondary" style="font-size:10px;padding:4px;width:100%">FICHA</button>
        </li>
      `;
    }).join("");
  }


  // =========================================================
  // CANAL DE RÁDIO
  // =========================================================

  function renderRadioLog() {

    const log = $("#radioLog");

    if (!log) return;

    const entries = lastState.radioEntries || [];

    if (entries.length === 0) {

      log.innerHTML = `
        <div class="log-entry system">
          [SISTEMA] Canal aberto. Aguardando atividade da rede.
        </div>
      `;

      return;
    }

    log.innerHTML = entries.map((entry) => {

      return `
        <div class="log-entry ${escapeHtml(entry.kind || "")}">

          <span class="ts">
            [${escapeHtml(entry.ts || "")}]
          </span>

          ${escapeHtml(entry.message || "")}

        </div>
      `;

    }).join("");
  }


  // =========================================================
  // MAPA TÁTICO
  // =========================================================

  function renderMap() {

    const markersEl = $("#mapMarkers");
    const agentsEl = $("#mapAgents");

    if (!markersEl || !agentsEl) return;

    const missions = lastState.missions || [];
    const agents = lastState.agents || [];


    // -------------------------------------------------------
    // MISSÕES
    // -------------------------------------------------------

    markersEl.innerHTML = missions.map((m) => {

      const pos = getLocationPosition(m.location);

      return `
        <div
          class="map-mission ${m.status} ${m.stage || ""}"
          style="left:${pos.x}%; top:${pos.y}%;"
          data-mission-id="${escapeHtml(m.id)}"
        >

          <span class="mission-dot"></span>

          <span class="mission-label">
            ${escapeHtml(m.title)}
          </span>

        </div>
      `;

    }).join("");


    // -------------------------------------------------------
    // AGENTES
    // -------------------------------------------------------

    const keep = new Set();

    agents.forEach((a) => {

      const activeMission = missions.find((m) =>

        m.status === "andamento" &&

        m.assignedIds?.includes(a.id)

      );


      const returning = missions.some((m) =>

        m.returningIds?.includes(a.id)

      );


      const traveling = missions.some((m) =>

        m.travelingIds?.includes(a.id)

      );


      const target = returning

        ? HQ_POSITION

        : activeMission

          ? getLocationPosition(
              activeMission.location
            )

          : HQ_POSITION;


      let marker = agentsEl.querySelector(
        `.map-agent[data-agent-id="${CSS.escape(String(a.id))}"]`
      );


      // -----------------------------------------------------
      // AGENTE AINDA NÃO EXISTE NO DOM
      // -----------------------------------------------------

      if (!marker) {

        marker = document.createElement("div");

        marker.className = "map-agent";

        marker.dataset.agentId = a.id;

        marker.innerHTML = a.foto
          ? `<img src="${escapeHtml(a.foto)}" alt="${escapeHtml(a.name)}">`
          : `<div class="agent-pin"><div class="agent-dot"></div><div class="agent-code">${escapeHtml(a.id)}</div></div>`;


        const start =

          traveling || returning

            ? HQ_POSITION

            : target;


        marker.style.left = `${start.x}%`;

        marker.style.top = `${start.y}%`;

        agentsEl.appendChild(marker);


        if (traveling) {

          marker.classList.add("traveling");

          requestAnimationFrame(() => {

            marker.style.left =
              `${target.x}%`;

            marker.style.top =
              `${target.y}%`;

          });

        } else if (returning) {

          marker.classList.add("returning");

          requestAnimationFrame(() => {

            marker.style.left =
              `${HQ_POSITION.x}%`;

            marker.style.top =
              `${HQ_POSITION.y}%`;

          });

        }

        keep.add(String(a.id));

        return;
      }


      // -----------------------------------------------------
      // AGENTE JÁ EXISTE
      // -----------------------------------------------------

      marker.classList.toggle(
        "traveling",
        traveling
      );

      marker.classList.toggle(
        "returning",
        returning
      );

      marker.style.left =
        `${target.x}%`;

      marker.style.top =
        `${target.y}%`;

      keep.add(String(a.id));

    });


    // -------------------------------------------------------
    // REMOVE AGENTES QUE NÃO EXISTEM MAIS
    // -------------------------------------------------------

    agentsEl
      .querySelectorAll(".map-agent")
      .forEach((el) => {

        if (
          !keep.has(
            String(el.dataset.agentId)
          )
        ) {

          el.remove();
        }

      });
  }


  // =========================================================
  // POPUP DE CHAMADO RECEBIDO
  // =========================================================

  function renderDispatchPreview() {

    let host = $("#playerDispatchModalHost");


    // -------------------------------------------------------
    // FALLBACK
    // -------------------------------------------------------

    if (!host) {

      const cityMap = $("#cityMap");

      if (!cityMap) return;

      host = document.createElement("div");

      host.id =
        "playerDispatchModalHost";

      cityMap.appendChild(host);
    }


    const preview =
      lastState.dispatchPreview;


    // -------------------------------------------------------
    // NENHUM CHAMADO
    // -------------------------------------------------------

    if (!preview) {

      host.innerHTML = "";

      return;
    }


    // -------------------------------------------------------
    // DADOS DO CLIENTE
    // -------------------------------------------------------

    const cliente =
      preview.chamadoCliente;

    const solicitante =
      cliente?.solicitante ||
      "SOLICITANTE DESCONHECIDO";

    const mensagem =
      cliente?.mensagem ||
      "Nenhuma mensagem registrada.";


    // -------------------------------------------------------
    // OBJETIVOS
    // -------------------------------------------------------

    const requisitos =

      Array.isArray(
        preview.requisitosTaticos
      ) &&
      preview.requisitosTaticos.length

        ? preview.requisitosTaticos
            .map(
              (r) =>
                `<li>${escapeHtml(r)}</li>`
            )
            .join("")

        : `
            <li>
              O objetivo da operação será
              informado pelo Dispatcher.
            </li>
          `;


    // -------------------------------------------------------
    // RENDER DO POPUP
    // -------------------------------------------------------

    host.innerHTML = `

      <div class="player-dispatch-backdrop">

        <section
          class="player-dispatch-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Chamado recebido"
        >

          <header class="player-dispatch-header">

            <span>
              CHAMADO RECEBIDO
            </span>

            <span class="player-dispatch-live">
              ● AO VIVO
            </span>

          </header>


          <div class="player-dispatch-body">

            <div class="player-dispatch-title">

              ${escapeHtml(
                preview.titulo ||
                preview.title ||
                "NOVA OPERAÇÃO"
              )}

            </div>


            <div class="player-dispatch-label">
              SOLICITANTE
            </div>

            <div class="player-dispatch-caller">
              ${escapeHtml(solicitante)}
            </div>


            <div class="player-dispatch-label">
              PEDIDO
            </div>

            <div class="player-dispatch-message">
              "${escapeHtml(mensagem)}"
            </div>


            <div class="player-dispatch-label">
              O QUE PRECISA SER FEITO
            </div>

            <ul class="player-dispatch-objectives">
              ${requisitos}
            </ul>


            <div class="player-dispatch-hint">

              DISCUTA COM O DISPATCHER QUAL UNIDADE
              DEVE ASSUMIR A OPERAÇÃO.

            </div>

          </div>

        </section>

      </div>

    `;
  }


  // =========================================================
  // APLICAR ESTADO RECEBIDO
  // =========================================================

  function applyState(state) {

    if (!state) return;

    sessionStartedAt = Number.isFinite(state.sessionStartedAt)
      ? state.sessionStartedAt : null;
    tickClock();

    lastState = {

      agents: state.agents || [],

      missions: state.missions || [],

      dispatchPreview:
        state.dispatchPreview || null,

      radioEntries:
        state.radioEntries || []

    };


    renderAgents();

    renderRadioLog();

    renderMap();

    renderDispatchPreview();

    renderPlayerIdentity();
  }


  // =========================================================
  // ESTADO INICIAL
  // =========================================================

  applyState(
    sdnGetLastState()
  );


  // =========================================================
  // ATUALIZAÇÕES EM TEMPO REAL
  // =========================================================

  sdnOnStateUpdate(
    applyState
  );


  // =========================================================
  // GARANTIR RENDERIZAÇÃO APÓS O DOM
  // =========================================================

  document.addEventListener(
  "DOMContentLoaded",
  () => {
    renderAgents();
    renderRadioLog();
    renderMap();
    renderDispatchPreview();
    renderPlayerIdentity();
  }
);


  // =========================================================
  // VALIDAÇÃO FINAL DA SESSÃO
  // =========================================================

  if (!playerSession) {

    stopHeartbeat();

    redirectToLogin();

    return;
  }

  const logoutButton = $("#logoutPlayer");

  $("#agentList")?.addEventListener("click", event => {
    const card = event.target.closest(".player-roster-card");
    if (card) showAgentProfile(lastState.agents.find(a => a.login === card.dataset.agentLogin));
  });

  if (logoutButton) {
    logoutButton.addEventListener("click", () => {
      logoutPlayer();
    });
  }


  // =========================================================
  // INICIA PRESENÇA
  // =========================================================

  startHeartbeat();


})();
