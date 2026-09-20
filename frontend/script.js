/* ===== SDN-VIGIA — Lógica do Dispatcher =====
   Tudo em memória. Recarregar a página zera o estado (por design). */

(() => {
  "use strict";

  // ---------- Estado ----------
  let agents = [];      // { id, name, spec, status: 'disponivel' | 'campo' | 'ferido' }
  let missions = [];    // { id, title, type, threat, location, status: 'pendente'|'andamento'|'concluida'|'falhou', assignedIds: [], showAssign: bool }
  let agentSeq = 1;
  let missionSeq = 1;

  // ---------- Dados de geração aleatória ----------
  const MISSION_TYPES = [
    "Resgate", "Contenção", "Investigação", "Combate Direto",
    "Sabotagem", "Extração", "Vigilância", "Escolta"
  ];
  const THREAT_LEVELS = [
    { value: "baixa", label: "Baixa" },
    { value: "media", label: "Média" },
    { value: "alta", label: "Alta" },
    { value: "critica", label: "Crítica" }
  ];
  const LOCATIONS = [
    "Distrito Portuário", "Torre Aurora", "Metrô — Linha 4",
    "Complexo Industrial Norte", "Ponte Vytal", "Universidade Central",
    "Represa Elysium", "Estação Baixa Órbita", "Zona Ribeirinha",
    "Central de Energia 7", "Bairro Marlowe", "Túneis do Setor 9"
  ];
  const CODENAME_WORDS = [
    "GRIFO", "ECLIPSE", "SENTINELA", "MARÉ NEGRA", "CINZA",
    "VÓRTICE", "ALVORADA", "FALCÃO", "QUIMERA", "SILÊNCIO",
    "HORIZONTE", "RUPTURA"
  ];

  // ---------- Utilidades ----------
  const $ = (sel) => document.querySelector(sel);
  const pad = (n) => String(n).padStart(2, "0");

  function nowTs() {
    const d = new Date();
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function threatLabel(value) {
    const t = THREAT_LEVELS.find((t) => t.value === value);
    return t ? t.label : value;
  }

  // ---------- Relógio ----------
  function tickClock() {
    $("#clock").textContent = nowTs();
  }
  setInterval(tickClock, 1000);
  tickClock();

  // ---------- Log de rádio ----------
  function pushLog(message, kind = "") {
    const log = $("#radioLog");
    const entry = document.createElement("div");
    entry.className = `log-entry ${kind}`;
    entry.innerHTML = `<span class="ts">[${nowTs()}]</span>${escapeHtml(message)}`;
    log.prepend(entry);
  }

  // ---------- Populaar selects de missão ----------
  function populateMissionSelects() {
    const typeSel = $("#missionType");
    const threatSel = $("#missionThreat");
    typeSel.innerHTML = MISSION_TYPES.map((t) => `<option value="${t}">${t}</option>`).join("");
    threatSel.innerHTML = THREAT_LEVELS.map((t) => `<option value="${t.value}">${t.label}</option>`).join("");
  }

  // ---------- Agentes ----------
  function addAgent(name, spec) {
    const agent = {
      id: agentSeq++,
      name: name.trim(),
      spec: spec.trim() || "SEM ESPECIALIDADE REGISTRADA",
      status: "disponivel"
    };
    agents.push(agent);
    pushLog(`Unidade ${agent.name} registrada na rede.`, "system");
    renderAgents();
    renderMissions(); // pode habilitar despacho em missões pendentes
  }

  function setAgentStatus(id, status) {
    const agent = agents.find((a) => a.id === id);
    if (!agent) return;
    agent.status = status;
    renderAgents();
    renderMissions();
  }

  function renderAgents() {
    const list = $("#agentList");
    $("#agentCount").textContent = agents.length;

    if (agents.length === 0) {
      list.innerHTML = `<li class="empty-state">NENHUMA UNIDADE REGISTRADA. ADICIONE ACIMA.</li>`;
      return;
    }

    list.innerHTML = agents.map((a) => {
      const badgeClass = a.status === "disponivel" ? "disponivel" : a.status === "campo" ? "campo" : "ferido";
      const badgeText = a.status === "disponivel" ? "DISPONÍVEL" : a.status === "campo" ? "EM CAMPO" : "FERIDO";

      let actions = "";
      if (a.status !== "campo") {
        if (a.status === "ferido") {
          actions = `<button type="button" class="secondary" data-action="set-disponivel" data-id="${a.id}">MARCAR DISPONÍVEL</button>`;
        } else {
          actions = `<button type="button" class="danger" data-action="set-ferido" data-id="${a.id}">MARCAR FERIDO</button>`;
        }
      } else {
        actions = `<span class="mission-meta">EM OPERAÇÃO — retorna ao concluir a missão</span>`;
      }

      return `
        <li class="agent-card" data-agent-id="${a.id}">
          <div class="agent-card-top">
            <div>
              <div class="agent-name">${escapeHtml(a.name)}</div>
              <div class="agent-spec">${escapeHtml(a.spec)}</div>
            </div>
            <span class="badge ${badgeClass}">${badgeText}</span>
          </div>
          <div class="agent-actions">${actions}</div>
        </li>
      `;
    }).join("");
  }

  // ---------- Missões ----------
  function addMission({ title, type, threat, location }) {
    const mission = {
      id: missionSeq++,
      title: title.trim(),
      type,
      threat,
      location: location.trim() || pick(LOCATIONS),
      status: "pendente",
      assignedIds: [],
      showAssign: false
    };
    missions.push(mission);
    pushLog(`Nova operação na fila: "${mission.title}" (${mission.type} — ameaça ${threatLabel(mission.threat).toUpperCase()}).`, "dispatch");
    renderMissions();
  }

  function generateRandomMission() {
    const type = pick(MISSION_TYPES);
    const threat = pick(THREAT_LEVELS).value;
    const location = pick(LOCATIONS);
    const title = `OPERAÇÃO ${pick(CODENAME_WORDS)}`;
    addMission({ title, type, threat, location });
  }

  function toggleAssignPanel(missionId) {
    missions.forEach((m) => {
      m.showAssign = m.id === missionId ? !m.showAssign : m.showAssign;
    });
    renderMissions();
  }

  function confirmDispatch(missionId) {
    const mission = missions.find((m) => m.id === missionId);
    if (!mission) return;

    const checked = Array.from(
      document.querySelectorAll(`[data-mission-id="${missionId}"] .assign-list input[type="checkbox"]:checked`)
    ).map((el) => Number(el.value));

    if (checked.length === 0) {
      pushLog(`Tentativa de despacho sem unidades selecionadas para "${mission.title}".`, "fail");
      return;
    }

    mission.assignedIds = checked;
    mission.status = "andamento";
    mission.showAssign = false;

    checked.forEach((id) => setAgentStatusSilent(id, "campo"));

    const names = agents.filter((a) => checked.includes(a.id)).map((a) => a.name).join(", ");
    pushLog(`Despachado: ${names} → "${mission.title}" (${mission.location}).`, "dispatch");

    renderAgents();
    renderMissions();
  }

  function setAgentStatusSilent(id, status) {
    const agent = agents.find((a) => a.id === id);
    if (agent) agent.status = status;
  }

  function resolveMission(missionId, outcome) {
    const mission = missions.find((m) => m.id === missionId);
    if (!mission) return;

    mission.status = outcome; // 'concluida' ou 'falhou'

    // Libera as unidades envolvidas (voltam a disponível, a menos que o mestre marque ferido depois)
    mission.assignedIds.forEach((id) => setAgentStatusSilent(id, "disponivel"));

    if (outcome === "concluida") {
      pushLog(`Operação "${mission.title}" concluída com sucesso. Unidades retornando à base.`, "success");
    } else {
      pushLog(`Operação "${mission.title}" fracassou. Unidades retornando à base.`, "fail");
    }

    renderAgents();
    renderMissions();
  }

  function removeMission(missionId) {
    missions = missions.filter((m) => m.id !== missionId);
    renderMissions();
  }

  function renderMissions() {
    const list = $("#missionList");

    if (missions.length === 0) {
      list.innerHTML = `<li class="empty-state">NENHUMA OPERAÇÃO NA FILA.</li>`;
      return;
    }

    // Pendentes e em andamento primeiro, depois resolvidas
    const order = { pendente: 0, andamento: 1, concluida: 2, falhou: 2 };
    const sorted = [...missions].sort((a, b) => order[a.status] - order[b.status]);

    list.innerHTML = sorted.map((m) => {
      const statusLabel = {
        pendente: "PENDENTE",
        andamento: "EM ANDAMENTO",
        concluida: "CONCLUÍDA",
        falhou: "FALHOU"
      }[m.status];

      const statusClass = {
        pendente: "threat-media",
        andamento: "threat-alta",
        concluida: "threat-baixa",
        falhou: ""
      }[m.status];

      let body = `
        <div class="mission-card-top">
          <div>
            <div class="mission-title">${escapeHtml(m.title)}</div>
            <div class="mission-meta">${escapeHtml(m.type)} · ${escapeHtml(m.location)}</div>
          </div>
          <span class="threat-${m.threat}">AMEAÇA: ${threatLabel(m.threat).toUpperCase()}</span>
        </div>
        <div class="mission-status ${statusClass}">STATUS: ${statusLabel}</div>
      `;

      if (m.status === "pendente") {
        const available = agents.filter((a) => a.status === "disponivel");
        body += `<div class="mission-actions">
          <button type="button" class="amber" data-action="toggle-assign" data-id="${m.id}">DESPACHAR UNIDADES</button>
          <button type="button" class="danger" data-action="remove" data-id="${m.id}">REMOVER DA FILA</button>
        </div>`;

        if (m.showAssign) {
          if (available.length === 0) {
            body += `<div class="assign-panel"><div class="mission-meta">NENHUMA UNIDADE DISPONÍVEL NO MOMENTO.</div></div>`;
          } else {
            body += `
              <div class="assign-panel" data-mission-id="${m.id}">
                <div class="assign-list">
                  ${available.map((a) => `
                    <label>
                      <input type="checkbox" value="${a.id}">
                      ${escapeHtml(a.name)} <span class="agent-spec">(${escapeHtml(a.spec)})</span>
                    </label>
                  `).join("")}
                </div>
                <button type="button" data-action="confirm-dispatch" data-id="${m.id}">CONFIRMAR DESPACHO</button>
              </div>
            `;
          }
        }
      } else if (m.status === "andamento") {
        const names = agents.filter((a) => m.assignedIds.includes(a.id)).map((a) => a.name).join(", ");
        body += `<div class="mission-assigned">EM CAMPO: ${escapeHtml(names || "—")}</div>`;
        body += `<div class="mission-actions">
          <button type="button" data-action="resolve-success" data-id="${m.id}">MARCAR CONCLUÍDA</button>
          <button type="button" class="danger" data-action="resolve-fail" data-id="${m.id}">MARCAR FALHA</button>
        </div>`;
      } else {
        const names = agents.filter((a) => m.assignedIds.includes(a.id)).map((a) => a.name).join(", ");
        body += `<div class="mission-assigned">UNIDADES ENVOLVIDAS: ${escapeHtml(names || "—")}</div>`;
        body += `<div class="mission-actions">
          <button type="button" class="secondary" data-action="remove" data-id="${m.id}">ARQUIVAR</button>
        </div>`;
      }

      return `<li class="mission-card" data-mission-id="${m.id}">${body}</li>`;
    }).join("");
  }

  // ---------- Eventos ----------
  function init() {
    populateMissionSelects();
    renderAgents();
    renderMissions();

    $("#agentForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const nameInput = $("#agentName");
      const specInput = $("#agentSpec");
      if (!nameInput.value.trim()) return;
      addAgent(nameInput.value, specInput.value);
      nameInput.value = "";
      specInput.value = "";
      nameInput.focus();
    });

    $("#missionForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const titleInput = $("#missionTitle");
      if (!titleInput.value.trim()) return;
      addMission({
        title: titleInput.value,
        type: $("#missionType").value,
        threat: $("#missionThreat").value,
        location: $("#missionLocation").value
      });
      titleInput.value = "";
      $("#missionLocation").value = "";
      titleInput.focus();
    });

    $("#genRandom").addEventListener("click", generateRandomMission);

    // Delegação de eventos para listas dinâmicas
    $("#agentList").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const id = Number(btn.dataset.id);
      if (btn.dataset.action === "set-ferido") setAgentStatus(id, "ferido");
      if (btn.dataset.action === "set-disponivel") setAgentStatus(id, "disponivel");
    });

    $("#missionList").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const id = Number(btn.dataset.id);
      switch (btn.dataset.action) {
        case "toggle-assign": toggleAssignPanel(id); break;
        case "confirm-dispatch": confirmDispatch(id); break;
        case "resolve-success": resolveMission(id, "concluida"); break;
        case "resolve-fail": resolveMission(id, "falhou"); break;
        case "remove": removeMission(id); break;
      }
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();