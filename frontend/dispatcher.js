/* ===== SDN-VIGIA — Lógica do Dispatcher =====
   Estado em memória (zera ao recarregar). A cada mudança, o estado
   é transmitido pra tela dos jogadores via sdnBroadcastState().

   Missões chegam de duas formas:
   1) Automaticamente, quando o horário real entra na janela de uma
      missão do MISSION_POOL (missoes-pool.js) — sem botão, sem sorteio.
   2) Manualmente, se você inserir uma no formulário de improviso.

   Cada missão despachada passa por 3 estágios ("stage"):
   afazer -> complicacao -> resultado. */

(() => {

  "use strict";

  const API_BASE_URL = window.SDN_API_BASE_URL || "/api";

  // =========================================================
  // PROTEÇÃO DE ACESSO — DISPATCHER
  // =========================================================

  const session = JSON.parse(
    sessionStorage.getItem("sdn-session") || "null"
  );

  if (!session || session.type !== "dispatcher") {
    window.location.href = "login.html";
    return;
  }

  // ---------- Estado ----------

  let agents = [];       // { id, name, especialidade, hpMax, hpCurrent, mods, pericias, dispatchStatus }
  let missions = [];     // { id, title, type, threat, location, status, assignedIds, showAssign, stage, complication }
  let agentSeq = 1;
  let missionSeq = 1;
  const appStartTime = Date.now(); // referência: instante em que o dispatcher foi aberto
  let poolCursor = 0;      // índice da próxima missão do pool a chegar
  let dispatchModal = null; // { missionId, selection: [agentId|null, ...] } — modal de despacho ativo
  let radioEntries = [];

  // ---------- Autenticação / presença dos jogadores ----------

// Presença termina somente quando o jogador faz logout.
const PLAYER_HEARTBEAT_TIMEOUT = Number.POSITIVE_INFINITY;

let authCheckTimer = null;


// ============================================================
// APLICA O ESTADO DE PRESENÇA DE UM AGENTE
// ============================================================

function applyAgentPresence(login, loggedIn, lastSeen = Date.now()) {
  if (!login) return;

  const agent = agents.find(
    (a) => a.login === login
  );

  if (!agent) return;

  const wasLoggedIn = agent.loggedIn;

  agent.loggedIn = loggedIn;
  agent.lastSeen = loggedIn
    ? lastSeen
    : 0;

  // Quando o agente entra, ele fica disponível
  // somente se não estiver ocupado por outra operação.
  if (
    loggedIn &&
    agent.dispatchStatus === "offline"
  ) {
    agent.dispatchStatus = "disponivel";
  }

  // Quando sai, não interrompemos uma missão
  // nem um período de descanso.
  if (
    !loggedIn &&
    agent.dispatchStatus !== "campo" &&
    agent.dispatchStatus !== "descansando"
  ) {
    agent.dispatchStatus = "offline";
  }

  // Nada mudou.
  if (wasLoggedIn === loggedIn) {
    return;
  }

  if (loggedIn) {

    pushLog(
      `${agent.name} entrou na rede.`,
      "success"
    );

    renderAgents();
    renderMap();

    // Animação de entrada do agente no roster/mapa.
    requestAnimationFrame(() => {

      document
        .querySelectorAll(
          `.roster-card[data-agent-id="${agent.id}"],
           .map-agent[data-agent-id="${agent.id}"]`
        )
        .forEach((el) => {

          el.classList.remove(
            "agent-login-enter"
          );

          // Força o navegador a reiniciar a animação.
          void el.offsetWidth;

          el.classList.add(
            "agent-login-enter"
          );

          window.setTimeout(() => {
            el.classList.remove(
              "agent-login-enter"
            );
          }, 900);

        });

    });

  } else {

    pushLog(
      `${agent.name} saiu da rede.`,
      "system"
    );

    renderAgents();
    renderMap();
  }

  syncPlayers();
}


// ============================================================
// APLICA O ESTADO COMPLETO DE PRESENÇA
// ============================================================

function applyAuthState(state) {
  if (!state) return;

  agents.forEach((agent) => {

    const session = state[agent.login];

    const isOnline =
      session &&
      session.loggedIn === true &&
      session.lastSeen &&
      Date.now() -
        Number(session.lastSeen) <=
        PLAYER_HEARTBEAT_TIMEOUT;

    applyAgentPresence(
      agent.login,
      !!isOnline,
      isOnline
        ? Number(session.lastSeen)
        : 0
    );

  });
}


// ============================================================
// RECEBE EVENTOS EM TEMPO REAL
// ============================================================

function handlePlayerAuth(payload) {
  if (!payload) return;

  // Evento completo vindo do localStorage.
  if (
    payload.type === "auth-state"
  ) {
    applyAuthState(payload.state);
    return;
  }

  if (!payload.login) return;

  switch (payload.type) {

    case "agent-login":

      applyAgentPresence(
        payload.login,
        true,
        Number(
          payload.timestamp || Date.now()
        )
      );

      break;


    case "agent-heartbeat": {

      const agent = agents.find(
        (a) => a.login === payload.login
      );

      if (!agent) return;

      agent.loggedIn = true;
      agent.lastSeen =
        Number(
          payload.timestamp || Date.now()
        );

      if (
        agent.dispatchStatus === "offline"
      ) {
        agent.dispatchStatus =
          "disponivel";

        renderAgents();
        renderMap();
        syncPlayers();
      }

      break;
    }


    case "agent-logout":

      applyAgentPresence(
        payload.login,
        false,
        0
      );

      break;
  }
}


// ============================================================
// VERIFICA HEARTBEATS EXPIRADOS
// ============================================================

function checkPlayerPresence() {

  // Primeiro consulta o estado persistente.
  if (
    typeof sdnCleanupExpiredSessions ===
    "function"
  ) {
    sdnCleanupExpiredSessions();
  }

  if (
    typeof sdnGetAuthState !==
    "function"
  ) {
    return;
  }

  const state =
    sdnGetAuthState();

  let changed = false;

  agents.forEach((agent) => {

    const session =
      state[agent.login];

    const isOnline =
      session &&
      session.loggedIn === true &&
      session.lastSeen &&
      Date.now() -
        Number(session.lastSeen) <=
        PLAYER_HEARTBEAT_TIMEOUT;

    if (isOnline) {

      const newLastSeen =
        Number(session.lastSeen);

      if (
        !agent.loggedIn ||
        agent.lastSeen !== newLastSeen
      ) {

        const wasLoggedIn =
          agent.loggedIn;

        agent.loggedIn = true;
        agent.lastSeen =
          newLastSeen;

        if (
          agent.dispatchStatus ===
          "offline"
        ) {
          agent.dispatchStatus =
            "disponivel";
        }

        if (!wasLoggedIn) {
          pushLog(
            `${agent.name} restabeleceu conexão com a rede.`,
            "success"
          );
        }

        changed = true;
      }

    } else if (agent.loggedIn) {

      agent.loggedIn = false;
      agent.lastSeen = 0;

      if (
        agent.dispatchStatus !== "campo" &&
        agent.dispatchStatus !== "descansando"
      ) {
        agent.dispatchStatus =
          "offline";
      }

      pushLog(
        `${agent.name} perdeu conexão com a rede.`,
        "fail"
      );

      changed = true;
    }

  });

  if (changed) {
    renderAgents();
    renderMap();
    syncPlayers();
  }
}

  // ---------- Utilidades ----------
  const $ = (sel) => document.querySelector(sel);
  const pad = (n) => String(n).padStart(2, "0");

  // Liga um evento só se o elemento existir — um elemento removido/renomeado
  // no HTML não deve mais derrubar o restante do init() (foi exatamente
  // isso que quebrou o clique no mapa quando o #manualToggle foi removido).
  function on(id, event, handler) {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, handler);
    else console.warn(`SDN-VIGIA: elemento #${id} não encontrado — evento "${event}" não conectado.`);
  }

  function nowTs() {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

  radioEntries.push({
    message: "Canal aberto. Aguardando atividade da rede.",
    kind: "system",
    ts: nowTs()
});

function elapsedMinutes() {
  return (Date.now() - appStartTime) / 60000;
}

  function elapsedLabel() {
    const totalSec = Math.floor((Date.now() - appStartTime) / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}min ${pad(s)}s`;
  }

  // Formata uma duração em minutos (float) como "Xmin Ys", nunca negativo.
  function formatMinSec(minutesFloat) {
    const totalSec = Math.max(0, Math.round(minutesFloat * 60));
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}min ${pad(s)}s`;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // ---------- Inicialização do roster a partir de AGENTS_SEED ----------
  function loadSeedAgents() {
  agents = AGENTS_SEED.map((seed) => ({
    id: agentSeq++,
    login: seed.login,
    name: seed.name,
    foto: seed.foto || null,
    especialidade: seed.especialidade,
    hpMax: seed.hpMax,
    hpCurrent: seed.hpCurrent,
    mods: { ...seed.mods },
    pericias: [...seed.pericias],

    loggedIn: false,
    lastSeen: 0,

    dispatchStatus: "offline"
  }));

  // Aplica quem está online pelo sync.js
  if (typeof sdnGetAuthState === "function") {
    applyAuthState(sdnGetAuthState());
  }

  renderAgents();
  renderMissions();
  renderMap();
  syncPlayers();
}


  let agentStatusApiLoading = false;
  const normalizeLogin = (value) => String(value || "").trim().toLowerCase();

  function applyBackendAgent(backendAgent) {
    const login = normalizeLogin(backendAgent.login);
    const localAgent = agents.find((agent) => login && normalizeLogin(agent.login) === login);
    if (!localAgent) return;
    localAgent.backendId = backendAgent.id;
    // Local missions continue to own their local roster state.
    if (missions.some((m) => m.backendId == null && m.status === "andamento" && m.assignedIds.includes(localAgent.id))) return;
    if (localAgent.localRest) return;
    localAgent.restUntil = backendAgent.restUntil ? Date.parse(backendAgent.restUntil) : null;
    localAgent.dispatchStatus = ["ocupado", "campo"].includes(backendAgent.dispatchStatus)
      ? "campo"
      : backendAgent.dispatchStatus === "descansando" ? "descansando"
      : localAgent.loggedIn ? "disponivel" : "offline";
  }

  async function updateBackendAgentStatuses() {
    if (agentStatusApiLoading || !session?.token) return;
    agentStatusApiLoading = true;
    try {
      const headers = { Authorization: `Bearer ${session.token}` };
      const release = await fetch(`${API_BASE_URL}/Agents/update-status`, { method: "POST", headers });
      if (!release.ok) throw new Error(`Atualização de agentes recusada (${release.status}).`);
      const response = await fetch(`${API_BASE_URL}/Agents`, { headers });
      if (!response.ok) throw new Error(`Consulta de agentes recusada (${response.status}).`);
      (await response.json()).forEach(applyBackendAgent);
      renderAgents();
      renderMap();
      syncPlayers();
    } catch (error) {
      console.error("SDN-VIGIA: erro atualizando agentes:", error);
    } finally { agentStatusApiLoading = false; }
  }

  // ---------- Relógio + varredura do pool + temporizadores automáticos ----------
  function tick() {
    $("#clock").textContent = nowTs();
    $("#sessionTimer").textContent = elapsedLabel();

    try {
      checkMissionTimers();
      checkPlayerPresence();
      updateBackendAgentStatuses();
      fetchAvailableMissions();
      updateCountdowns();
    } catch (err) {
      console.error("SDN-VIGIA: erro no tick():", err);
    }
  }
  setInterval(tick, 1000);

  // Missões enviadas pelo painel do mestre (mestre.html) chegam por aqui —
  // tanto via fila (garantido) quanto via canal ao vivo (instantâneo).
  let missionApiLoading = false;

async function fetchAvailableMissions() {
  if (missionApiLoading) return;

  const currentSession = JSON.parse(
    sessionStorage.getItem("sdn-session") || "null"
  );

  if (!currentSession?.token) return;

  missionApiLoading = true;

  try {
    const headers = {
      "Authorization": `Bearer ${currentSession.token}`
    };

    // Descobre qual operação está rodando.
    const operationsResponse = await fetch(
      `${API_BASE_URL}/Operations`,
      {
        method: "GET",
        headers
      }
    );

    if (!operationsResponse.ok) {
      throw new Error(
        `Erro ao consultar operações (${operationsResponse.status}).`
      );
    }

    const operations = await operationsResponse.json();

    const activeOperation = operations.find(
      (operation) =>
        String(operation.status)
          .trim()
          .toLowerCase() === "em_andamento"
    );

    if (!activeOperation) return;

    // Essa chamada também dispara a liberação automática
    // baseada em DelayMinutes no backend.
    const missionsResponse = await fetch(
      `${API_BASE_URL}/Missions/available/${activeOperation.id}`,
      {
        method: "GET",
        headers
      }
    );

    if (!missionsResponse.ok) {
      throw new Error(
        `Erro ao consultar missões disponíveis (${missionsResponse.status}).`
      );
    }

    const availableMissions = await missionsResponse.json();

    // O Dispatcher é a fonte de verdade da fila local. Se uma missão
    // antiga foi removida do PostgreSQL, retire também o marcador persistido
    // no estado compartilhado para ele não voltar no mapa.
    const availableBackendIds = new Set(
      availableMissions.map((raw) => raw.id)
    );

    const staleMissions = missions.filter(
      (mission) =>
        mission.backendId != null &&
        !availableBackendIds.has(mission.backendId)
    );

    if (staleMissions.length > 0) {
      missions = missions.filter(
        (mission) =>
          mission.backendId == null ||
          availableBackendIds.has(mission.backendId)
      );
      renderMissions();
      renderMap();
      syncPlayers();
    }

    availableMissions.forEach((raw) => {
      // Não adiciona novamente uma missão que já está na memória.
      const alreadyExists = missions.some(
        (mission) => mission.backendId === raw.id
      );

      if (alreadyExists) return;

      addMission(raw, "backend");
    });

  } catch (error) {
    console.error(
      "SDN-VIGIA: erro ao consultar missões do backend:",
      error
    );
  } finally {
    missionApiLoading = false;
  }
}

  // ---------- Log de rádio (só nesta tela) ----------
  function pushLog(message, kind = "") {
  const entryData = {
    message,
    kind,
    ts: nowTs()
  };

  radioEntries.unshift(entryData);

  const log = $("#radioLog");

  if (!log) return;

  const entry = document.createElement("div");
  entry.className = `log-entry ${kind}`;

  entry.innerHTML =
    `<span class="ts">[${entryData.ts}]</span>${escapeHtml(message)}`;

  log.prepend(entry);
}

  // ---------- Sincronização com a tela dos jogadores ----------
  function syncPlayers() {
  sdnBroadcastState({
    sessionStartedAt: appStartTime,
    agents,
    missions,
    radioEntries,
    dispatchPreview: dispatchModal
      ? (() => {
          const mission = missions.find(
            (m) => m.id === dispatchModal.missionId
          );

          if (!mission || mission.status !== "pendente") {
            return null;
          }

          return {
            missionId: mission.id,
            title: mission.title,
            chamadoCliente: mission.chamadoCliente || null,
            requisitosTaticos: Array.isArray(mission.requisitosTaticos)
              ? mission.requisitosTaticos
              : []
          };
        })()
      : null,
    ts: Date.now()
  });
}

  // ---------- Selects de missão (form manual) ----------
  function populateMissionSelects() {
    const typeSel = $("#missionType");
    const threatSel = $("#missionThreat");
    typeSel.innerHTML = MISSION_TYPES.map((t) => `<option value="${t.id}">${t.label}</option>`).join("");
    threatSel.innerHTML = THREAT_LEVELS.map((t) => `<option value="${t.value}">${t.label}</option>`).join("");
  }

  // ---------- Pool de missões (recepção automática, em ordem, a cada N minutos) ----------
  function checkPoolArrivals() {
  if (typeof MISSION_POOL === "undefined") return;

  while (poolCursor < MISSION_POOL.length) {
    const mission = MISSION_POOL[poolCursor];

    const arrivalTime = Number(mission.apareceEmMinutos ?? 0);

    if (elapsedMinutes() < arrivalTime) {
      break;
    }

    addMission(mission, "pool");
    poolCursor++;
  }
}

  function renderPoolStatus() {
    const list = $("#poolStatusList");
    if (!list) return;

    if (
      typeof MISSION_POOL === "undefined" ||
      MISSION_POOL.length === 0
    ) {
      list.innerHTML = `
        <li class="empty-state">
          NENHUMA MISSÃO CADASTRADA EM missoes-pool.js.
        </li>
      `;
      return;
    }

    list.innerHTML = MISSION_POOL.map((pm, i) => {
      let st;
      let label;

      const arrivalTime = Number(pm.apareceEmMinutos ?? 0);
      const remaining = arrivalTime - elapsedMinutes();

      if (i < poolCursor) {
        st = "saudavel";
        label = "RECEBIDA";
      }

      else if (i === poolCursor) {
        st = "campo";
        label = remaining <= 0
          ? "CHEGANDO..."
          : `EM ${formatMinSec(remaining)}`;
      }

      else {
        st = "ferido";
        label = `ÀS ${formatMinSec(arrivalTime)}`;
      }

      const title =
        pm.title ||
        pm.titulo ||
        "(sem título)";

      const mt =
        missionTypeById(pm.type || pm.tipo);

      return `
        <li class="agent-card">
          <div class="agent-card-top">

            <div>
              <div class="agent-name">
                ${escapeHtml(title)}
              </div>

              <div class="agent-spec">
                ${escapeHtml(
                  mt ? mt.label : "TIPO INVÁLIDO"
                )}
              </div>
            </div>

            <span class="badge ${st}">
              ${label}
            </span>

          </div>
        </li>
      `;
    }).join("");
  }

  // ---------- Temporizadores automáticos de missão (afazer -> complicação -> resultado) ----------
  function checkMissionTimers() {
    let rosterChanged = false;
    missions.forEach((m) => {
      const now = Date.now();
      const complicationDueAt = m.complicationDueAt || (appStartTime + m.afazerStartedAt * 60000 + TIMING.complicationDelayMin * 60000);
      const resolutionDueAt = m.resolutionDueAt || (m.complication?.chosenAt != null
        ? appStartTime + m.complication.chosenAt * 60000 + TIMING.resolutionDelayMin * 60000 : Infinity);
      if (m.stage === "afazer" && now >= complicationDueAt) {
        advanceToComplication(m.id);
      } else if (m.stage === "resolvendo" && now >= resolutionDueAt) {
        finalizeResolution(m.id);
      }
    });
    agents.forEach((agent) => {
      if (agent.dispatchStatus === "descansando" && (agent.localRest || agent.backendId == null) && agent.restUntil != null && Date.now() >= agent.restUntil) {
        agent.dispatchStatus = agent.loggedIn ? "disponivel" : "offline";
        delete agent.localRest;
        delete agent.restUntil;
        rosterChanged = true;
        pushLog(`${agent.name} concluiu o descanso e voltou à disponibilidade.`, "system");
      }
    });
    if (rosterChanged) { renderAgents(); syncPlayers(); }
  }

  // Atualiza só os textos de contagem regressiva, sem re-renderizar a lista
  // inteira (pra não perder seleções de checkbox em andamento noutra missão).
  function updateCountdowns() {
  document.querySelectorAll("[data-countdown]").forEach((el) => {

    const [kind, idStr] = el.dataset.countdown.split(":");
    const m = missions.find(mm => mm.id === Number(idStr));

    if (!m) return;

    if (kind === "resolucao" && m.stage === "resolvendo") {
      el.textContent =
        `Resultado em ${formatMinSec(
          TIMING.resolutionDelayMin -
          (elapsedMinutes() - m.complication.chosenAt)
        )}`;
    }
  });
}

  // ---------- Mapa da cidade ----------
  function initials(name) {
    return name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  }

  function findActiveMissionForAgent(agentId) {
    return missions.find((m) => m.status === "andamento" && m.assignedIds.includes(agentId));
  }

  function renderMap() {
    const markersEl = $("#mapMarkers");
    const agentsEl = $("#mapAgents");
    if (!markersEl || !agentsEl) return;

    markersEl.innerHTML = missions.map((m) => {
      const pos = getLocationPosition(m.location);
      let cls, symbol;
      if (m.status === "pendente") { cls = "pendente"; symbol = "!"; }
      else if (m.status === "andamento") { cls = "ativa"; symbol = "★"; }
      else { cls = "finalizada"; symbol = m.status === "concluida" ? "✓" : "✗"; }
      return `<button type="button" class="map-marker ${cls}" data-action="open-mission" data-id="${m.id}" style="left:${pos.x}%; top:${pos.y}%;" title="${escapeHtml(m.title)}">${symbol}</button>`;
    }).join("");

    agentsEl.innerHTML = agents.map((a) => {
      const returningMission = missions.find((m) => m.returningIds?.includes(a.id));
      const activeMission = returningMission || (a.dispatchStatus === "campo" ? findActiveMissionForAgent(a.id) : null);
      const pos = activeMission ? getLocationPosition(activeMission.location) : HQ_POSITION;
      const traveling = activeMission?.travelingIds?.includes(a.id);
      const returning = !!returningMission;
      const start = traveling ? HQ_POSITION : pos;
      const feridoClass = healthStatus(a) === "ferido" ? "ferido" : "";
      const content = a.foto
        ? `<img src="${a.foto}" alt="${escapeHtml(a.name)}">`
        : initials(a.name);
      return `<div class="map-agent ${feridoClass} ${traveling || returning ? "traveling" : ""} ${returning ? "returning" : ""}" data-agent-id="${a.id}" style="left:${start.x}%; top:${start.y}%;" title="${escapeHtml(a.name)}">${content}</div>`;
    }).join("");
  }

  // ---------- Agentes ----------
  function addAgent({ name, especialidade, hpMax, mods, pericias }) {
    const agent = {
      id: agentSeq++,
      name: name.trim(),
      especialidade: especialidade.trim() || "SEM ESPECIALIDADE REGISTRADA",
      hpMax,
      hpCurrent: hpMax,
      mods,
      pericias,
      login: null,
      loggedIn: false,
      lastSeen: 0,
      dispatchStatus: "offline"
    };
    agents.push(agent);
    pushLog(`Unidade ${agent.name} registrada na rede.`, "system");
    renderAgents();
    renderMissions();
    syncPlayers();
  }

  function adjustHp(id, newValue) {
    const agent = agents.find((a) => a.id === id);
    if (!agent) return;
    agent.hpCurrent = Math.max(0, Math.min(agent.hpMax, Math.round(newValue)));
    renderAgents();
    renderMissions();
    syncPlayers();
  }

  function renderAgents() {
    const list = $("#agentList");
    const onlineCount = agents.filter(
      (a) => a.loggedIn
    ).length;

    $("#agentCount").textContent = onlineCount;

    if (agents.length === 0) {
      list.innerHTML = `<li class="empty-state">NENHUMA UNIDADE REGISTRADA.</li>`;
      renderMap();
      return;
    }

    list.innerHTML = agents.map((a) => {
      const status = a.loggedIn
      ? combinedStatus(a)
      : "offline";

    const badgeText = a.loggedIn
      ? statusLabel(status)
      : "OFFLINE";

      const modsHtml = Object.entries(MOD_LABELS).map(([key, label]) => {
        const v = a.mods[key] ?? 0;
        const sign = v >= 0 ? "+" : "";
        return `<span>${label} <b>${sign}${v}</b></span>`;
      }).join("");

      const inModal = !!dispatchModal;
      const eligible = inModal ? canBeDispatched(a) : true;
      const selected = inModal && dispatchModal.selection.includes(a.id);
      const stateClass = inModal ? (eligible ? "selectable" : "unavailable") : "";
      const selectedClass = selected ? "selected" : "";

      const photoHtml = a.foto
        ? `<img class="roster-card-photo" src="${a.foto}" alt="${escapeHtml(a.name)}" draggable="false">`
        : `<div class="roster-card-photo" draggable="false" style="display:flex;align-items:center;justify-content:center;color:var(--green);font-size:20px;">${initials(a.name)}</div>`;

      return `
        <li class="roster-card ${stateClass} ${selectedClass}" data-agent-id="${a.id}" draggable="${inModal && eligible}">
          <div class="roster-card-status ${status}">${badgeText}</div>
          ${photoHtml}
          <div class="roster-card-name">${escapeHtml(a.name)}</div>
          <div class="roster-card-hp">${a.hpCurrent}/${a.hpMax} PV</div>
          <details>
            <summary>detalhes</summary>
            <div class="agent-spec" style="margin-bottom:4px;">${escapeHtml(a.especialidade)}</div>
            <div class="mods-row">${modsHtml}</div>
            <div class="pericias-row">${escapeHtml(a.pericias.join(", ") || "—")}</div>
            <div class="hp-edit">
              <input type="number" min="0" max="${a.hpMax}" value="${a.hpCurrent}" data-hp-input="${a.id}" aria-label="Ajustar PV atual">
              <button type="button" class="secondary" data-action="apply-hp" data-id="${a.id}">APLICAR</button>
            </div>
          </details>
        </li>
      `;
    }).join("");
    renderMap();
  }

  function parseMissionJson(jsonValue, fallback = null) {
  if (jsonValue == null || jsonValue === "") {
    return fallback ?? null;
  }

  if (typeof jsonValue !== "string") {
    return jsonValue;
  }

  try {
    return JSON.parse(jsonValue);
  } catch (error) {
    console.error(
      "SDN-VIGIA: JSON inválido recebido na missão:",
      jsonValue,
      error
    );

    return fallback ?? null;
  }
}

  // ---------- Missões ----------
  // Aceita tanto o formato "curto" antigo (title/type/threat/location)
  // quanto o formato rico do pool/mestre (titulo/tipo/risco/local +
  // chamadoCliente/requisitosTaticos/exigenciasAtributos/complicacaoCustom),
  // e normaliza tudo pro mesmo objeto interno.
  function addMission(raw, origin = "manual") {
    const title = (raw.title || raw.titulo || "").trim();
    const type = raw.type || raw.tipo;
    const threat = raw.threat || raw.risco;
    const location = (raw.location || raw.local || "").trim() || pick(LOCATIONS);

    if (!title || !missionTypeById(type) || !THREAT_LEVELS.some((t) => t.value === threat)) {
      pushLog(`Missão recebida (${origin}) com dados inválidos — ignorada.`, "fail");
      return;
    }

    const mission = {
      id: missionSeq++,

      // ID verdadeiro da missão no PostgreSQL.
      // Missões manuais/legadas continuam sem backendId.
      backendId:
        origin === "backend"
          ? raw.id
          : null,

      title,
      type,
      threat,
      location,
      vagasMaximas:
        raw.maxSlots ??
        raw.vagasMaximas ??
        null,

      duracaoMinutos:
        raw.durationMinutes ??
        raw.duracaoMinutos ??
        null,

      chamadoCliente:
        parseMissionJson(
          raw.clientCallJson,
          raw.chamadoCliente
        ),

      requisitosTaticos:
        parseMissionJson(
          raw.tacticalRequirementsJson,
          raw.requisitosTaticos
        ),

      periciasRecomendadas:
        parseMissionJson(
          raw.recommendedSkillsJson,
          raw.periciasRecomendadas
        ),

      exigenciasAtributos:
        parseMissionJson(
          raw.attributeRequirementsJson,
          raw.exigenciasAtributos
        ),

      complicacaoCustom:
        parseMissionJson(
          raw.customComplicationJson,
          raw.complicacaoCustom
        ),
      status: "pendente",
      assignedIds: [],
      showAssign: false,
      stage: null,
      complication: null
    };
    if (origin === "backend" && raw.status === "despachada") {
      mission.status = "andamento";
      mission.stage = "afazer";
      mission.assignedIds = (raw.missionAgents || []).map((assignment) => {
        const agent = agents.find((a) => a.backendId === assignment.agentId ||
          (assignment.agent?.login && normalizeLogin(a.login) === normalizeLogin(assignment.agent.login)));
        if (!agent) return null;
        agent.backendId = assignment.agentId;
        agent.dispatchStatus = "campo";
        return agent.id;
      }).filter((id) => id != null);
      const dispatchedAt = Date.parse(raw.dispatchedAt);
      mission.afazerStartedAt = (dispatchedAt - appStartTime) / 60000;
      mission.complicationDueAt = dispatchedAt + (mission.duracaoMinutos ?? TIMING.complicationDelayMin) * 60000;
      mission.travelingIds = [];
      mission.returningIds = [];
    }
    missions.push(mission);
    const mt = missionTypeById(type);
    const originTag = {
      pool: "[POOL] ",
      mestre: "[MESTRE] ",
      manual: "[MANUAL] ",
      backend: "[CENTRAL] "
    }[origin] || "";
    pushLog(`${originTag}Nova operação na fila: "${mission.title}" (${mt.label} — ameaça ${threatLabel(mission.threat).toUpperCase()}).`, "dispatch");
    renderMissions();
    syncPlayers();
  }

  function teamLimit(mission) {
    return mission.vagasMaximas || ({ baixa: 2, media: 2, alta: 3, critica: 4 })[mission.threat] || 2;
  }

  function selectedModalAgents() {
    if (!dispatchModal) return [];
    return dispatchModal.selection.filter(Boolean)
      .map((id) => agents.find((a) => a.id === id)).filter(Boolean);
  }

  function openMission(missionId) {
  const mission = missions.find((m) => m.id === missionId);

  if (!mission || mission.status !== "pendente") return;

  const slots = teamLimit(mission);
  const assigned = mission.assignedIds.slice(0, slots);

  dispatchModal = {
    missionId,
    selection: [
      ...assigned,
      ...Array(
        Math.max(0, slots - assigned.length)
      ).fill(null)
    ]
  };

  renderAgents();
  renderDispatchModal();
  syncPlayers();
}

  function closeMission() {
  dispatchModal = null;

  renderAgents();
  renderDispatchModal();
  syncPlayers();
}

  function selectModalAgent(agentId) {
    if (!dispatchModal) return;
    const agent = agents.find((a) => a.id === agentId);
    if (!agent || !canBeDispatched(agent)) return;
    const index = dispatchModal.selection.indexOf(agentId);
    if (index >= 0) dispatchModal.selection[index] = null;
    else {
      const empty = dispatchModal.selection.indexOf(null);
      if (empty < 0) return;
      dispatchModal.selection[empty] = agentId;
    }
    renderAgents();
    renderDispatchModal();
  }

  function teamRadarSVG(mission, team, size = 220) {
    const axes = ["combate", "mobilidade", "vigor", "intelecto", "carisma"];
    const center = size / 2, radius = size * .32, step = Math.PI * 2 / axes.length;
    const at = (i, r) => { const a = -Math.PI / 2 + i * step; return [center + r * Math.cos(a), center + r * Math.sin(a)]; };
    const pts = (values) => values.map((v, i) => at(i, radius * Math.max(0, Math.min(1, v / 8))).join(",")).join(" ");
    const reqProfile = getRequiredProfile(mission);
    const requirements = axes.map((key) => reqProfile[key] ?? 1.5);
    const strength = axes.map((key) => teamStatPower(team, key));
    const rings = [1, .75, .5, .25].map((n) => `<polygon points="${axes.map((_,i)=>at(i,radius*n).join(",")).join(" ")}" fill="none" stroke="rgba(255,220,150,.25)"/>`).join("");
    const labels = axes.map((key,i) => { const [x,y]=at(i,radius+18); return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-size="10" fill="#755f42">${MOD_LABELS[key]}</text>`; }).join("");
    return `<svg class="team-radar" viewBox="0 0 ${size} ${size}" aria-label="Comparativo entre equipe e requisitos"><polygon points="${pts(requirements)}" fill="rgba(255,120,70,.13)" stroke="#dc7650" stroke-width="2"/><polygon points="${pts(strength)}" fill="rgba(255,190,70,.28)" stroke="#ffd36c" stroke-width="2"/>${rings}${labels}</svg>`;
  }

  function missionChance(mission, team) {
    return calculateMissionChance(
      team,
      mission.type,
      mission.threat,
      {
        periciasRecomendadas: mission.periciasRecomendadas
      }
    );
  }

  function missionChanceBreakdown(mission, team) {
    const mt = missionTypeById(mission.type);

    const primary = teamStatPower(team, mt.primary);
    const support = teamStatPower(team, mt.secondary);

    const relevantSkills =
      Array.isArray(mission.periciasRecomendadas) &&
      mission.periciasRecomendadas.length
        ? mission.periciasRecomendadas
        : mt.pericias;

    const skilled = team.filter((a) =>
      a.pericias.some((p) => relevantSkills.includes(p))
    ).length;

    const skillBonus = Math.min(12, skilled * 4);

    const coordination = Math.min(
      8,
      Math.max(0, team.length - 1) * 3
    );

    const penalty = {
      baixa: 20,
      media: 32,
      alta: 44,
      critica: 56
    }[mission.threat] ?? 32;

    return `BASE 25 + ${MOD_LABELS[mt.primary]} ${primary.toFixed(1)}×8 + ${MOD_LABELS[mt.secondary]} ${support.toFixed(1)}×5 + PERÍCIAS ${skillBonus} + EQUIPE ${coordination} − RISCO ${penalty}`;
  }

  function renderDispatchModal() {
    const host = $("#dispatchModalHost");
    if (!host) return;
    if (!dispatchModal) { host.innerHTML = ""; return; }
    const mission = missions.find((m) => m.id === dispatchModal.missionId);
    if (!mission) { host.innerHTML = ""; return; }
    const mt = missionTypeById(mission.type), team = selectedModalAgents(), chance = missionChance(mission, team), breakdown = missionChanceBreakdown(mission, team);
    const slots = dispatchModal.selection.map((id, i) => {
      const agent = id ? agents.find((a) => a.id === id) : null;
      return `<button type="button" class="dispatch-slot ${agent ? "filled" : ""}" data-slot="${i}">${agent ? (agent.foto ? `<img src="${agent.foto}" alt="${escapeHtml(agent.name)}">` : initials(agent.name)) : "ARRASTE<br>AGENTE"}</button>`;
    }).join("");

    const cliente = mission.chamadoCliente;
    const clienteBox = cliente ? `
      <div class="caller-avatar">${cliente.avatarSolicitante ? `<img src="${cliente.avatarSolicitante}" alt="${escapeHtml(cliente.solicitante || "")}">` : "☎"}</div>
      <div class="caller-id">${escapeHtml(cliente.solicitante || "SOLICITANTE DESCONHECIDO")}</div>
      <p class="caller-quote">"${escapeHtml(cliente.mensagem || "")}"</p>
    ` : `<div class="caller-avatar">☎</div><div class="caller-id">SEM CHAMADO REGISTRADO</div><p class="caller-quote">Missão inserida sem informações do solicitante.</p>`;

    const requisitos = Array.isArray(mission.requisitosTaticos)
      && mission.requisitosTaticos.length
        ? mission.requisitosTaticos
            .map((r) => `<li>${escapeHtml(r)}</li>`)
            .join("")
        : `
            <li>
              Prioridade:
              <b>${escapeHtml(MOD_LABELS[mt.primary])}</b>
            </li>
            <li>
              Apoio:
              <b>${escapeHtml(MOD_LABELS[mt.secondary])}</b>
            </li>
          `;

    const skills = Array.isArray(mission.periciasRecomendadas)
      && mission.periciasRecomendadas.length
        ? mission.periciasRecomendadas
        : mt.pericias;

    const periciasHtml = skills
      .map((pericia) => `
        <span class="dispatch-skill">
          ${escapeHtml(pericia)}
        </span>
      `)
      .join("");

    const periciasRecomendadas =
      Array.isArray(mission.periciasRecomendadas)
      && mission.periciasRecomendadas.length
        ? mission.periciasRecomendadas
            .map((p) => `
              <span style="
                display:inline-block;
                border:1px solid var(--green-dim);
                padding:3px 6px;
                font-size:10px;
                color:var(--green);
              ">
                ${escapeHtml(p)}
              </span>
            `)
            .join("")
        : mt.pericias
            .map((p) => `
              <span style="
                display:inline-block;
                border:1px solid var(--green-dim);
                padding:3px 6px;
                font-size:10px;
                color:var(--green);
              ">
                ${escapeHtml(p)}
              </span>
            `)
            .join("");

    host.innerHTML = `<div class="dispatch-modal-backdrop"><section class="dispatch-modal" role="dialog" aria-modal="true" aria-label="Detalhes da missão">
      <header class="dispatch-modal-header"><span>${escapeHtml(mission.title)}</span><button type="button" class="modal-close" data-action="close-modal">×</button></header>
      <div class="dispatch-modal-body dispatch-modal-3col">

        <div class="dispatch-modal-caller">
          <div class="col-label">CHAMADO</div>
          ${clienteBox}
        </div>

        <div class="dispatch-modal-radar">
          <div class="col-label">ANÁLISE TÁTICA <span class="only-dispatcher">(só dispatcher)</span></div>
          ${teamRadarSVG(mission, team)}
          <div class="radar-key"><span>■ EQUIPE</span><span>■ REQUISITOS</span></div>
          <div class="dispatch-coverage">${chance}% <small>CHANCE DE ÊXITO</small></div>
          <div class="chance-breakdown">${breakdown}</div>
        </div>

        <div class="dispatch-modal-info">

  <div class="col-label">
    DETALHES DA OPERAÇÃO
    <span class="only-dispatcher">(só dispatcher)</span>
    </div>

    <div class="mission-meta">
      ${escapeHtml(mt.label)} · ${escapeHtml(mission.location)}
    </div>

    <div class="threat-${mission.threat}">
      RISCO ${threatLabel(mission.threat).toUpperCase()}
      · ${teamLimit(mission)} VAGAS
    </div>

    <div class="dispatch-section">

      <div class="dispatch-section-title">
        OBJETIVOS
      </div>

      <ul class="dispatch-objectives">
        ${requisitos}
      </ul>

    </div>

    <div class="dispatch-section">

      <div class="dispatch-section-title">
        PERÍCIAS RECOMENDADAS
      </div>

      <div class="dispatch-skills">
        ${periciasHtml}
      </div>

    </div>

    <div class="dispatch-slots">
      ${slots}
    </div>

    <div class="slot-count">
      ${team.length}/${teamLimit(mission)} AGENTES SELECIONADOS
    </div>

  </div>

      </div>
      <footer class="dispatch-modal-footer"><button type="button" class="secondary" data-action="close-modal">VOLTAR</button><button type="button" class="amber" data-action="confirm-modal" ${team.length ? "" : "disabled"}>DESPACHAR EQUIPE</button></footer>
    </section></div>`;
  }

  function toggleAssignPanel(missionId) {
    openMission(missionId);
  }

  async function confirmDispatch(missionId) {
  const mission = missions.find((m) => m.id === missionId);

  if (!mission) {
    pushLog("Missão não encontrada para despacho.", "fail");
    return;
  }

  if (mission.dispatching || mission.status !== "pendente") return;

  const checked =
    dispatchModal?.missionId === missionId
      ? dispatchModal.selection.filter(Boolean)
      : [];

  if (checked.length === 0) {
    pushLog(
      `Selecione pelo menos um agente para "${mission.title}".`,
      "fail"
    );
    return;
  }

  const selectedAgents = checked
    .map((id) => agents.find((agent) => agent.id === id))
    .filter(Boolean);

  if (selectedAgents.length !== checked.length) {
    pushLog(
      "Não foi possível identificar todos os agentes selecionados.",
      "fail"
    );
    return;
  }

  if (selectedAgents.some((agent) => !canBeDispatched(agent)) || checked.length > teamLimit(mission)) {
    pushLog("A equipe selecionada não está disponível ou excede as vagas.", "fail");
    return;
  }

  // MISSÃO VINDO DO BACKEND
  if (mission.backendId != null) {
    const currentSession = JSON.parse(
      sessionStorage.getItem("sdn-session") || "null"
    );

    if (!currentSession?.token) {
      pushLog(
        "Sessão do Dispatcher inválida. Faça login novamente.",
        "fail"
      );
      return;
    }

    try {
      mission.dispatching = true;
      // Busca os IDs reais dos agentes no PostgreSQL.
      const agentsResponse = await fetch(
        `${API_BASE_URL}/Agents`,
        {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${currentSession.token}`
          }
        }
      );

      if (!agentsResponse.ok) {
        throw new Error(
          `Não foi possível consultar os agentes (${agentsResponse.status}).`
        );
      }

      const backendAgents = await agentsResponse.json();

      const backendAgentIds = [];

      for (const localAgent of selectedAgents) {
        const backendAgent = backendAgents.find(
          (apiAgent) =>
            String(apiAgent.login || "")
              .trim()
              .toLowerCase() ===
            String(localAgent.login || "")
              .trim()
              .toLowerCase()
        );

        if (!localAgent.login || !backendAgent) {
          throw new Error(
            `O agente ${localAgent.name} não foi encontrado no servidor.`
          );
        }

        localAgent.backendId = backendAgent.id;
        backendAgentIds.push(backendAgent.id);
      }

      const dispatchResponse = await fetch(
        `${API_BASE_URL}/Missions/${mission.backendId}/dispatch`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${currentSession.token}`
          },
          body: JSON.stringify(backendAgentIds)
        }
      );

      if (!dispatchResponse.ok) {
        let message = "";

        try {
          message = await dispatchResponse.text();
        } catch {}

        throw new Error(
          message ||
          `Servidor recusou o despacho (${dispatchResponse.status}).`
        );
      }

    } catch (error) {
      mission.dispatching = false;
      console.error(
        "[SDN-VIGIA] Falha no despacho:",
        error
      );

      pushLog(
        `Falha no despacho de "${mission.title}": ${
          error?.message || "erro desconhecido"
        }`,
        "fail"
      );

      return;
    }
  }

  mission.dispatching = false;
  // O servidor aceitou o despacho.
  mission.assignedIds = [...checked];
  mission.status = "andamento";
  mission.stage = "afazer";
  mission.afazerStartedAt = elapsedMinutes();

  mission.complicationDueAt =
    Date.now() +
    (
      mission.duracaoMinutos ??
      TIMING.complicationDelayMin
    ) * 60000;

  mission.travelingIds = [...checked];
  mission.returningIds = [];
  mission.showAssign = false;

  checked.forEach((id) => {
    const agent = agents.find((a) => a.id === id);

    if (agent) {
      agent.dispatchStatus = "campo";
    }
  });

  const names = selectedAgents
    .map((agent) => agent.name)
    .join(", ");

  // Fecha a ficha/modal.
  dispatchModal = null;

  pushLog(
    `Despachado: ${names} → "${mission.title}" (${mission.location}).`,
    "dispatch"
  );

  renderAgents();
  renderMissions();
  renderDispatchModal();
  renderMap();

  animateMissionDeparture(mission);

  syncPlayers();
}

  function animateMissionDeparture(mission) {
    const destination = getLocationPosition(mission.location);
    requestAnimationFrame(() => {
      mission.travelingIds.forEach((id) => {
        const marker = document.querySelector(`.map-agent[data-agent-id="${id}"]`);
        if (!marker) return;
        marker.style.left = `${destination.x}%`;
        marker.style.top = `${destination.y}%`;
        marker.classList.add("in-flight");
      });
    });
    window.setTimeout(() => {
      mission.travelingIds = [];
      document.querySelectorAll(".map-agent.in-flight").forEach((marker) => marker.classList.remove("in-flight", "traveling"));
    }, 1800);
  }

  function advanceToComplication(missionId) {
    const mission = missions.find((m) => m.id === missionId);
    if (!mission) return;
    const team = agents.filter((a) => mission.assignedIds.includes(a.id));
    const options = buildComplicationOptions(mission, team);
    mission.complication = { options, chosenKey: null, success: null, roll: null };
    mission.stage = "complicacao";
    const custom = mission.complicacaoCustom;
    pushLog(custom?.titulo
      ? `Complicação em "${mission.title}": ${custom.titulo}! Aguardando escolha do jogador.`
      : `Complicação em "${mission.title}"! Aguardando escolha do jogador.`, "dispatch");
    renderMissions();
    syncPlayers();
  }

  function chooseComplicationOption(missionId, optionKey) {
    const mission = missions.find((m) => m.id === missionId);
    if (!mission || !mission.complication) return;
    const option = mission.complication.options.find((o) => o.key === optionKey);
    if (!option) return;

    mission.complication.chosenKey = optionKey;
    mission.complication.chosenAt = elapsedMinutes();
    mission.resolutionDueAt = Date.now() + TIMING.resolutionDelayMin * 60000;
    mission.stage = "resolvendo";

    pushLog(`"${mission.title}" — jogador escolheu "${option.label}". Resultado em ${TIMING.resolutionDelayMin}min.`, "dispatch");

    renderMissions();
    syncPlayers();
  }

  async function finalizeResolution(missionId) {
    const mission = missions.find((m) => m.id === missionId);

    if (!mission || !mission.complication) return;

    // Evita o tick tentar finalizar várias vezes enquanto
    // aguardamos a resposta da API.
    if (mission.finalizing) return;

    const option = mission.complication.options.find(
      (o) => o.key === mission.complication.chosenKey
    );

    if (!option) return;

    mission.finalizing = true;

    mission.pendingOutcome ??= rollOutcome(option.chance);
    const { roll, success } = mission.pendingOutcome;

    /*
    * Primeiro persistimos o resultado.
    * Se o backend rejeitar, não alteramos a missão local.
    */
    if (mission.backendId != null) {
      const currentSession = JSON.parse(
        sessionStorage.getItem("sdn-session") || "null"
      );

      if (!currentSession?.token) {
        mission.finalizing = false;

        pushLog(
          `Não foi possível concluir "${mission.title}": sessão inválida.`,
          "fail"
        );

        return;
      }

      const selectedNames = agents
        .filter((agent) =>
          mission.assignedIds.includes(agent.id)
        )
        .map((agent) => agent.name)
        .join(", ");

      const resultPayload = {
        outcome: success ? "sucesso" : "falha",
        chosenOption: option.label,
        chance: option.chance,
        roll: roll,
        summary:
          `${success ? "Sucesso" : "Falha"} em "${mission.title}". ` +
          `Abordagem: ${option.label}. ` +
          `Agentes: ${selectedNames || "não informado"}.`
      };

      try {
        const response = await fetch(
          `${API_BASE_URL}/Missions/${mission.backendId}/complete`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${currentSession.token}`
            },
            body: JSON.stringify(resultPayload)
          }
        );

        if (!response.ok) {
          const errorText = await response.text();

          throw new Error(
            errorText ||
            `Conclusão recusada pelo servidor (${response.status}).`
          );
        }

      } catch (error) {
        mission.finalizing = false;

        console.error(
          "SDN-VIGIA: erro ao concluir missão:",
          error
        );

        pushLog(
          `Falha ao registrar resultado de "${mission.title}": ${error.message}`,
          "fail"
        );

        return;
      }
    }

    /*
    * Backend confirmou.
    * Agora aplicamos o resultado visual/local.
    */
    mission.complication.roll = roll;
    mission.complication.success = success;

    mission.stage = "resultado";
    mission.status = success
      ? "concluida"
      : "falhou";

    mission.returningIds = [...mission.assignedIds];

    const injuries = [];

    mission.assignedIds.forEach((id) => {
      const agent = agents.find((a) => a.id === id);

      if (!agent) return;

      if (!success) {
        const alreadyInjured =
          healthStatus(agent) === "ferido";

        if (alreadyInjured) {
          agent.hpCurrent = 0;

          injuries.push(
            `${agent.name}: incapacitado`
          );
        } else {
          agent.hpCurrent = Math.min(
            agent.hpCurrent,
            Math.floor(agent.hpMax * 0.55)
          );

          injuries.push(
            `${agent.name}: ferido`
          );
        }
      }

      agent.localRest = mission.backendId == null;
      agent.dispatchStatus = "descansando";

      agent.restUntil =
        Date.now() +
        TIMING.restDelayMin * 60000;
    });

    mission.finalizing = false;

    pushLog(
      `"${mission.title}" — opção "${option.label}": ` +
      `${option.chance}% de chance ` +
      `(sucesso: 1–${option.chance}; ` +
      `falha: ${option.chance + 1}–100), ` +
      `rolou ${roll} → ${success ? "SUCESSO" : "FALHA"}.`,
      success ? "success" : "fail"
    );

    if (injuries.length) {
      pushLog(
        `Retorno após falha — ${injuries.join("; ")}.`,
        "fail"
      );
    }

    renderAgents();
    renderMissions();

    animateMissionReturn(mission);

    syncPlayers();
  }

  function animateMissionReturn(mission) {
    requestAnimationFrame(() => {
      mission.returningIds.forEach((id) => {
        const marker = document.querySelector(`.map-agent[data-agent-id="${id}"]`);
        if (!marker) return;
        marker.style.left = `${HQ_POSITION.x}%`;
        marker.style.top = `${HQ_POSITION.y}%`;
        marker.classList.add("in-flight");
      });
    });
    window.setTimeout(() => {
      mission.returningIds = [];
      // A missão já foi resolvida; sai da fila depois da chegada da equipe.
      removeMission(mission.id);
    }, 2600);
  }

  function removeMission(missionId) {
    missions = missions.filter((m) => m.id !== missionId);
    renderMissions();
    syncPlayers();
  }

  function renderMissions() {
    const list = $("#missionList");

    // Preserva seleções de checkbox em andamento (outra missão pode
    // re-renderizar a lista inteira por causa de um temporizador automático).
    const preservedChecks = {};
    list.querySelectorAll(".assign-panel[data-mission-id]").forEach((panel) => {
      const mid = panel.dataset.missionId;
      const checked = Array.from(panel.querySelectorAll('input[type="checkbox"]:checked')).map((cb) => cb.value);
      if (checked.length) preservedChecks[mid] = checked;
    });

    if (missions.length === 0) {
      list.innerHTML = `<li class="empty-state">NENHUMA OPERAÇÃO NA FILA.</li>`;
      renderMap();
      return;
    }

    const order = { pendente: 0, andamento: 1, concluida: 2, falhou: 2 };
    const sorted = [...missions].sort((a, b) => order[a.status] - order[b.status]);

    list.innerHTML = sorted.map((m) => {
      const mt = missionTypeById(m.type);
      let body = `
        <div class="mission-card-top">
          <div>
            <div class="mission-title">${escapeHtml(m.title)}</div>
            <div class="mission-meta">${escapeHtml(mt.label)} · ${escapeHtml(m.location)}</div>
          </div>
          <span class="threat-${m.threat}">AMEAÇA: ${threatLabel(m.threat).toUpperCase()}</span>
        </div>
      `;

      if (m.status === "pendente") {
        const eligible = agents.filter((a) => canBeDispatched(a));
        body += `<div class="mission-status threat-media">STATUS: PENDENTE</div>`;
        body += `<div class="mission-actions">
          <button type="button" class="amber" data-action="toggle-assign" data-id="${m.id}">DESPACHAR UNIDADES</button>
          <button type="button" class="danger" data-action="remove" data-id="${m.id}">REMOVER DA FILA</button>
        </div>`;

        if (m.showAssign) {
          if (eligible.length === 0) {
            body += `<div class="assign-panel"><div class="mission-meta">NENHUMA UNIDADE DISPONÍVEL NO MOMENTO.</div></div>`;
          } else {
            const scored = eligible.map((a) => ({ agent: a, score: computeScore(a, m.type) })).sort((x, y) => y.score - x.score);
            const topScore = scored[0].score;
            body += `
              <div class="assign-panel" data-mission-id="${m.id}">
                <div class="assign-list">
                  ${scored.map(({ agent: a, score }) => {
                    const isTop = score === topScore;
                    const warn = healthStatus(a) === "ferido" ? `<span class="warn">FERIDO</span>` : "";
                    return `
                      <label class="${isTop ? "top-pick" : ""}">
                        <input type="checkbox" value="${a.id}">
                        ${escapeHtml(a.name)} <span class="agent-spec">(${escapeHtml(a.especialidade)})</span>
                        ${warn}
                        <span class="score">PONTOS: ${score}</span>
                      </label>
                    `;
                  }).join("")}
                </div>
                <button type="button" data-action="confirm-dispatch" data-id="${m.id}">CONFIRMAR DESPACHO</button>
              </div>
            `;
          }
        }
      } else if (m.status === "andamento" && m.stage === "afazer") {
        const names = agents.filter((a) => m.assignedIds.includes(a.id)).map((a) => a.name).join(", ");
        body += `<div class="mission-status threat-alta">STATUS: AFAZER EM CURSO</div>`;
        body += `<div class="mission-assigned">EM CAMPO: ${escapeHtml(names || "—")}</div>`;
      } else if (m.status === "andamento" && m.stage === "complicacao") {
        const names = agents.filter((a) => m.assignedIds.includes(a.id)).map((a) => a.name).join(", ");
        body += `<div class="mission-status threat-critica">STATUS: COMPLICAÇÃO — AGUARDANDO ESCOLHA</div>`;
        body += `<div class="mission-assigned">EM CAMPO: ${escapeHtml(names || "—")}</div>`;
        body += `<div class="assign-panel">
          <div class="assign-list">
            ${m.complication.options.map((o) => `
              <div class="complication-option ${o.special ? "top-pick" : ""} ${o.risky ? "risky" : ""}">
                <div class="complication-option-text">
                  ${o.special ? "⭐ " : ""}${escapeHtml(o.label)}${o.special ? ` <span class="agent-spec">(perícia: ${escapeHtml(o.pericia)})</span>` : ""}
                  <span class="score">${o.chance}% (visível só aqui)</span>
                </div>
                <button type="button" class="amber" data-action="choose-option" data-id="${m.id}" data-key="${o.key}">JOGADOR ESCOLHEU ESTA</button>
              </div>
            `).join("")}
          </div>
        </div>`;
      } else if (m.status === "andamento" && m.stage === "resolvendo") {
        const names = agents.filter((a) => m.assignedIds.includes(a.id)).map((a) => a.name).join(", ");
        const chosen = m.complication.options.find((o) => o.key === m.complication.chosenKey);
        body += `<div class="mission-status threat-critica">STATUS: RESOLVENDO...</div>`;
        body += `<div class="mission-assigned">EM CAMPO: ${escapeHtml(names || "—")}</div>`;
        body += `<div class="mission-meta">Abordagem escolhida: ${escapeHtml(chosen ? chosen.label : "—")}</div>`;
        body += `<div class="mission-meta" data-countdown="resolucao:${m.id}">Resultado em ${formatMinSec(TIMING.resolutionDelayMin - (elapsedMinutes() - m.complication.chosenAt))}</div>`;
      } else if (m.status === "concluida" || m.status === "falhou") {
        const names = agents.filter((a) => m.assignedIds.includes(a.id)).map((a) => a.name).join(", ");
        const outcomeLabel = m.status === "concluida" ? "SUCESSO" : "FALHA";
        const outcomeClass = m.status === "concluida" ? "threat-baixa" : "threat-critica";
        const leadAgent = agents.find((a) => m.assignedIds.includes(a.id)) || null;
        const chosen = m.complication ? m.complication.options.find((o) => o.key === m.complication.chosenKey) : null;
        body += `<div class="mission-status ${outcomeClass}">RESULTADO: ${outcomeLabel}</div>`;
        body += `<div class="mission-assigned">UNIDADES ENVOLVIDAS: ${escapeHtml(names || "—")}</div>`;
        if (chosen) {
          body += `<div class="mission-meta">Abordagem: ${escapeHtml(chosen.label)} — ${chosen.chance}%: sucesso de 1–${chosen.chance}; falha de ${chosen.chance + 1}–100. Rolou ${m.complication.roll}.</div>`;
        }
        if (leadAgent) {
          body += `<div style="display:flex; justify-content:center; margin-top:8px;">${renderRadarSVG(leadAgent, 140)}</div>`;
        }
        body += `<div class="mission-actions">
          <button type="button" class="secondary" data-action="remove" data-id="${m.id}">ARQUIVAR</button>
        </div>`;
      }

      return `<li class="mission-card" data-mission-id="${m.id}">${body}</li>`;
    }).join("");

    Object.entries(preservedChecks).forEach(([mid, ids]) => {
      const panel = list.querySelector(`.assign-panel[data-mission-id="${mid}"]`);
      if (!panel) return;
      ids.forEach((id) => {
        const cb = panel.querySelector(`input[type="checkbox"][value="${id}"]`);
        if (cb) cb.checked = true;
      });
    });

    renderMap();
  }

  // ---------- Eventos ----------
  function init() {
    // Cada chamada de render fica isolada: se uma delas falhar (ex: um dado
    // mal formatado em missoes-pool.js), o erro vai pro console mas NÃO
    // impede o resto do init() de rodar — sobretudo o registro dos cliques
    // logo abaixo. Foi exatamente a falta disso que já quebrou o clique do
    // mapa duas vezes (um erro cedo no init() cancelava tudo que vinha depois).
    function safe(fn, label) {
      try { fn(); } catch (err) { console.error(`SDN-VIGIA: erro em ${label}:`, err); }
    }

    safe(loadSeedAgents, "loadSeedAgents");
    safe(populateMissionSelects, "populateMissionSelects");
    safe(renderAgents, "renderAgents");
    safe(renderMissions, "renderMissions");
    safe(syncPlayers, "syncPlayers");

    on("agentForm", "submit", (e) => {
      e.preventDefault();
      const name = $("#agentName").value;
      if (!name.trim()) return;
      const hpMax = Number($("#agentHpMax").value) || 1;
      const mods = {
        combate: Number($("#agentCombate").value) || 0,
        mobilidade: Number($("#agentMobilidade").value) || 0,
        vigor: Number($("#agentVigor").value) || 0,
        intelecto: Number($("#agentIntelecto").value) || 0,
        carisma: Number($("#agentCarisma").value) || 0
      };
      const pericias = $("#agentPericias").value.split(",").map((s) => s.trim()).filter(Boolean);
      addAgent({ name, especialidade: $("#agentSpec").value, hpMax, mods, pericias });
      e.target.reset();
    });

    on("missionForm", "submit", (e) => {
      e.preventDefault();
      const titleInput = $("#missionTitle");
      if (!titleInput.value.trim()) return;
      addMission({
        title: titleInput.value,
        type: $("#missionType").value,
        threat: $("#missionThreat").value,
        location: $("#missionLocation").value
      }, "manual");
      titleInput.value = "";
      $("#missionLocation").value = "";
      titleInput.focus();
    });

    on("agentList", "click", (e) => {
      const card = e.target.closest(".roster-card[data-agent-id]");
      if (card && dispatchModal && !e.target.closest("button, input, summary, details")) {
        selectModalAgent(Number(card.dataset.agentId));
        return;
      }
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const id = Number(btn.dataset.id);
      if (btn.dataset.action === "apply-hp") {
        const input = document.querySelector(`[data-hp-input="${id}"]`);
        if (input) adjustHp(id, Number(input.value));
      }
    });

    on("missionList", "click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const id = Number(btn.dataset.id);
      switch (btn.dataset.action) {
        case "toggle-assign": toggleAssignPanel(id); break;
        case "confirm-dispatch": confirmDispatch(id); break;
        case "advance-complication": advanceToComplication(id); break;
        case "choose-option": chooseComplicationOption(id, btn.dataset.key); break;
        case "remove": removeMission(id); break;
      }
    });

    on("mapMarkers", "click", (e) => {
      const marker = e.target.closest("[data-action='open-mission']");
      if (!marker) return;
      const id = Number(marker.dataset.id);
      const mission = missions.find((m) => m.id === id);
      if (!mission) return;

      if (mission.status === "pendente") {
        openMission(id);
        return;
      }

      // Missão já despachada (em andamento ou resolvida): não faz sentido
      // reabrir o modal de escalação — em vez disso, abre a fila e foca
      // no card dela, que é onde os controles daquele estágio já existem
      // (opções de complicação, marcar resultado, arquivar etc.).
      $("#queueDrawer").classList.add("open");
      requestAnimationFrame(() => {
        const card = document.querySelector(`.mission-card[data-mission-id="${id}"]`);
        if (!card) return;
        card.scrollIntoView({ behavior: "smooth", block: "center" });
        card.classList.add("highlight-flash");
        setTimeout(() => card.classList.remove("highlight-flash"), 1500);
      });
    });

    on("dispatchModalHost", "click", (e) => {
      const action = e.target.closest("[data-action]")?.dataset.action;
      if (action === "close-modal") closeMission();
      if (action === "confirm-modal" && dispatchModal) confirmDispatch(dispatchModal.missionId);
      const slot = e.target.closest(".dispatch-slot[data-slot]");
      if (slot && dispatchModal) {
        const index = Number(slot.dataset.slot);
        if (dispatchModal.selection[index]) { dispatchModal.selection[index] = null; renderAgents(); renderDispatchModal(); }
      }
    });

    on("agentList", "dragstart", (e) => {
      const card = e.target.closest(".roster-card[data-agent-id]");
      if (card && dispatchModal) {
        e.dataTransfer.effectAllowed = "copy";
        e.dataTransfer.setData("text/plain", card.dataset.agentId);
      }
    });
    on("dispatchModalHost", "dragover", (e) => {
      const slot = e.target.closest(".dispatch-slot");
      if (!slot) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      slot.classList.add("dragover");
    });
    on("dispatchModalHost", "dragleave", (e) => e.target.closest(".dispatch-slot")?.classList.remove("dragover"));
    on("dispatchModalHost", "drop", (e) => {
      const slot = e.target.closest(".dispatch-slot[data-slot]");
      if (!slot || !dispatchModal) return;
      e.preventDefault();
      slot.classList.remove("dragover");
      const id = Number(e.dataTransfer.getData("text/plain"));
      const agent = agents.find((a) => a.id === id);
      const index = Number(slot.dataset.slot);
      if (agent && canBeDispatched(agent) && !dispatchModal.selection.includes(id)) {
        dispatchModal.selection[index] = id; renderAgents(); renderDispatchModal();
      }
    });

    on("queueToggle", "click", () => $("#queueDrawer").classList.toggle("open"));
    on("queueClose", "click", () => $("#queueDrawer").classList.remove("open"));
    on("rosterToggle", "click", () => {
      $("#agentTools").open = true;
      $("#agentTools").scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });

    // Canal de autenticação dos jogadores
    if (typeof sdnOnAuthUpdate === "function") {
      sdnOnAuthUpdate(handlePlayerAuth);
    }

    if (typeof sdnGetAuthState === "function") {
      applyAuthState(sdnGetAuthState());
    }
    
  }

  document.addEventListener("DOMContentLoaded", init);
})();

