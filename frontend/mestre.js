/* ===== SDN-VIGIA — Painel do Mestre =====
   Monta uma missão no schema rico (o mesmo usado pelo missoes-pool.js)
   e envia pro dispatcher via sdnSendMissionRequest (sync.js). O
   dispatcher recebe, valida e integra à fila — não existe estado
   próprio aqui, esta tela só emite. */

// =========================================================
// PROTEÇÃO DE ACESSO — MESTRE
// =========================================================

const session = JSON.parse(
  sessionStorage.getItem("sdn-session") || "null"
);

if (!session || session.type !== "master") {
  window.location.href = "login.html";
}

function logoutMaster() {
  sessionStorage.removeItem("sdn-session");
  window.location.href = "login.html";
}

(() => {
  const API_BASE_URL = window.SDN_API_BASE_URL || "/api";
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const pad = (n) => String(n).padStart(2, "0");

  function populateSelects() {
    $("#mTipo").innerHTML = MISSION_TYPES.map((t) => `<option value="${t.id}">${t.label}</option>`).join("");
    $("#mRisco").innerHTML = THREAT_LEVELS.map((t) => `<option value="${t.value}">${t.label}</option>`).join("");
  }

  function attrOptionsHtml(selected) {
    return Object.entries(MOD_LABELS).map(([key, label]) =>
      `<option value="${key}" ${key === selected ? "selected" : ""}>${label}</option>`
    ).join("");
  }

  function populatePericias() {
  const host = $("#mPericias");
  if (!host) return;

  const pericias = [...new Set(
    MISSION_TYPES.flatMap((mission) => mission.pericias || [])
  )].sort((a, b) => a.localeCompare(b, "pt-BR"));

  host.innerHTML = pericias.map((pericia) => `
    <label class="mission-skill-option">
      <input
        type="checkbox"
        name="mPericia"
        value="${pericia}"
      >
      <span>${pericia}</span>
    </label>
  `).join("");
}

  // 3 linhas de opção de complicação (texto vazio = opção ignorada no envio).
  function renderOptionRows() {
    const defaults = ["combate", "mobilidade", "intelecto"];
    $("#compOptions").innerHTML = [0, 1, 2].map((i) => `
      <div class="form-row" style="margin-top:6px;">
        <input type="text" id="optTexto${i}" placeholder="OPÇÃO ${i + 1} (ex: Hackear o painel de segurança)">
        <select id="optAttr${i}" aria-label="Status usado nesta opção">${attrOptionsHtml(defaults[i])}</select>
        <input type="number" id="optMod${i}" placeholder="MODIFICADOR %" step="1" style="max-width:130px;">
      </div>
    `).join("");
  }

  function logSend(message, kind = "") {
    const log = $("#sendLog");
    const d = new Date();
    const ts = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    const entry = document.createElement("div");
    entry.className = `log-entry ${kind}`;
    entry.textContent = `[${ts}] ${message}`;
    log.prepend(entry);
  }

  function numOrNull(value) {
    const n = Number(value);
    return value !== "" && !Number.isNaN(n) ? n : null;
  }

  function buildComplicacaoCustom() {
    const titulo = $("#mCompTitulo").value.trim();
    const descricao = $("#mCompDescricao").value.trim();
    const opcoes = [0, 1, 2]
      .map((i) => ({
        id: `opt_${i + 1}`,
        texto: $(`#optTexto${i}`).value.trim(),
        atributoChave: $(`#optAttr${i}`).value,
        modificadorChance: numOrNull($(`#optMod${i}`).value) || 0
      }))
      .filter((op) => op.texto);

    if (!titulo && !descricao && opcoes.length === 0) return null;
    return { titulo: titulo || null, descricao: descricao || null, opcoes };
  }

  function buildExigenciasAtributos() {
    const fields = { combate: "#mCombate", mobilidade: "#mMobilidade", vigor: "#mVigor", intelecto: "#mIntelecto", carisma: "#mCarisma" };
    const values = {};
    let any = false;
    Object.entries(fields).forEach(([key, sel]) => {
      const v = numOrNull($(sel).value);
      if (v !== null) any = true;
      values[key] = v ?? 1.5;
    });
    return any ? values : null;
  }

  function logoutMaster() {
    sessionStorage.removeItem("sdn-session");
    window.location.href = "login.html";
  }

  function init() {

  populateSelects();

  populatePericias();

  renderOptionRows();

  const logoutButton = $("#logoutMaster");

  if (logoutButton) {
    logoutButton.addEventListener("click", logoutMaster);
  }

  $("#masterMissionForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const form = e.currentTarget;

  const titulo = $("#mTitulo").value.trim();
  const local = $("#mLocal").value.trim();
  const solicitante = $("#mSolicitante").value.trim();
  const mensagem = $("#mMensagem").value.trim();

  if (!titulo || !local || !solicitante || !mensagem) {
    logSend("Preencha os campos obrigatórios da missão.", "error");
    return;
  }

  const currentSession = JSON.parse(
    sessionStorage.getItem("sdn-session") || "null"
  );

  if (!currentSession?.token) {
    logSend("Sessão do Mestre inválida.", "error");
    return;
  }

  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${currentSession.token}`
  };

  try {
    // 1. Busca as operações
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

    // 2. Encontra a operação em andamento
    const activeOperation = operations.find((operation) =>
      String(operation.status)
        .trim()
        .toLowerCase() === "em_andamento"
    );

    if (!activeOperation) {
      throw new Error(
        "Nenhuma operação em andamento foi encontrada."
      );
    }

    // 3. Dados opcionais da missão
    const requisitosTaticos = $("#mRequisitos").value
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);

    const periciasRecomendadas = Array.from(
      document.querySelectorAll('input[name="mPericia"]:checked')
    ).map((input) => input.value);

    const exigenciasAtributos = buildExigenciasAtributos();
    const complicacaoCustom = buildComplicacaoCustom();

    // 4. Payload exatamente no formato esperado pelo backend
    const missionPayload = {
      operationId: activeOperation.id,

      title: titulo,
      type: $("#mTipo").value,
      threat: $("#mRisco").value,
      location: local,

      maxSlots: numOrNull($("#mVagas").value),

      delayMinutes:
        numOrNull($("#mDelay").value) ?? 0,

      durationMinutes:
        numOrNull($("#mDuracao").value),

      clientCallJson: JSON.stringify({
        solicitante: solicitante,
        avatarSolicitante:
          $("#mAvatar").value.trim() || null,
        mensagem: mensagem
      }),

      tacticalRequirementsJson:
        requisitosTaticos.length > 0
          ? JSON.stringify(requisitosTaticos)
          : null,

      recommendedSkillsJson:
        periciasRecomendadas.length > 0
          ? JSON.stringify(periciasRecomendadas)
          : null,

      attributeRequirementsJson:
        exigenciasAtributos
          ? JSON.stringify(exigenciasAtributos)
          : null,

      customComplicationJson:
        complicacaoCustom
          ? JSON.stringify(complicacaoCustom)
          : null,

      note: null
    };

    // 5. Salva diretamente no backend
    const missionResponse = await fetch(
      `${API_BASE_URL}/Missions`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(missionPayload)
      }
    );

    if (!missionResponse.ok) {
      const errorText = await missionResponse.text();

      throw new Error(
        errorText ||
        `Erro ao criar missão (${missionResponse.status}).`
      );
    }

    const createdMission = await missionResponse.json();

    // 6. Confirma criação
    logSend(
      `Missão "${createdMission.title}" criada. Liberação: ${createdMission.delayMinutes} min.`,
      "dispatch"
    );

    // 7. Limpa o formulário somente depois do POST funcionar
    form.reset();

    renderOptionRows();
    populateSelects();
    populatePericias();

  } catch (error) {
    console.error("[SDN-VIGIA] Erro ao criar missão:", error);

    logSend(
      error?.message || "Erro ao criar missão.",
      "error"
    );
  }
});
  }

  document.addEventListener("DOMContentLoaded", init);
})();
