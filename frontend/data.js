/* ===== SDN-VIGIA — Dados compartilhados =====
   Usado por dispatcher.js e jogadores.js.
   Para adicionar/editar agentes "fixos", edite AGENTS_SEED abaixo. */

const PROFICIENCY_BONUS = 4;

// Compact, read-only agent reference shared by both screens.
function showAgentProfile(agent) {
  if (!agent) return;
  document.getElementById("agentProfileDialog")?.close();
  const dialog = document.createElement("dialog");
  dialog.id = "agentProfileDialog";
  dialog.setAttribute("aria-labelledby", "agentProfileTitle");
  dialog.style.cssText = "width:min(560px,90vw);max-height:80vh;overflow:auto;background:#081a14;color:#c9decc;border:1px solid #6f9e79;padding:24px;box-shadow:0 12px 60px #000;font:inherit;";
  const title = document.createElement("h2");
  title.id = "agentProfileTitle";
  title.textContent = agent.name;
  title.style.color = "#48ff86";
  dialog.append(title);
  const section = (label, value) => {
    const heading = document.createElement("h3");
    heading.textContent = label;
    const text = document.createElement("p");
    text.textContent = value || "Não informado";
    text.style.cssText = "line-height:1.6;white-space:pre-wrap;";
    dialog.append(heading, text);
  };
  section("Especialidade / poder", agent.especialidade);
  const labels = {combate:"Combate",mobilidade:"Mobilidade",vigor:"Vigor",intelecto:"Intelecto",carisma:"Carisma"};
  section("Habilidades", Object.entries(labels).map(([key,label]) => {
    const value = Number(agent.mods?.[key] || 0);
    return label + ": " + (value >= 0 ? "+" : "") + value;
  }).join(" · "));
  section("Perícias", (agent.pericias || []).join(", "));
  section("Condição", statusLabel(combinedStatus(agent)) + " · " + agent.hpCurrent + "/" + agent.hpMax + " PV");
  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "FECHAR FICHA";
  close.addEventListener("click", () => dialog.close());
  dialog.append(close);
  dialog.addEventListener("click", event => { if (event.target === dialog) {
    const r=dialog.getBoundingClientRect();
    if(event.clientX<r.left || event.clientX>r.right || event.clientY<r.top || event.clientY>r.bottom) dialog.close();
  }});
  dialog.addEventListener("close", () => dialog.remove(), {once:true});
  document.body.append(dialog);
  dialog.showModal();
  close.focus();
}


// Ritmo automático do ciclo de missão (em minutos), controlado pelo dispatcher.js:
// - arrivalIntervalMin: intervalo entre uma missão aparecer e a próxima aparecer
// - complicationDelayMin: quanto tempo depois do despacho a complicação surge sozinha
// - resolutionDelayMin: quanto tempo depois da escolha do jogador a missão se resolve sozinha
const TIMING = {
  complicationDelayMin: 2,
  resolutionDelayMin: 2,
  restDelayMin: 2
};

const AGENTS_SEED = [
  {
    login: "dante",
    name: "Dante Verissimo",
    foto: "assets/dante-verissimo.png",
    especialidade: "Drenar poder",
    hpMax: 123, hpCurrent: 123,
    loggedIn: false,
    dispatchStatus: "offline",
    mods: { combate: 0, mobilidade: 3, vigor: 5, intelecto: 0, carisma: 5 },
    pericias: ["Enganação", "Intimidação", "Percepção", "Persuasão", "Furtividade"]
  },
  {
    login: "lucas",
    name: "Lucas Kobayashi",
    foto: "assets/lucas-kobayashi.png",
    especialidade: "Motoqueiro fantasma",
    hpMax: 136, hpCurrent: 136,
    loggedIn: false,
    dispatchStatus: "offline",
    mods: { combate: -1, mobilidade: 2, vigor: 2, intelecto: 0, carisma: 5 },
    pericias: ["Acrobacia", "Atletismo", "Intimidação", "Performance"]
  },
  {
    login: "samuel",
    name: "Samuel Rocha",
    foto: "assets/samuel-rocha.png",
    especialidade: "Materialização de luz",
    hpMax: 118, hpCurrent: 118,
    loggedIn: false,
    dispatchStatus: "offline",
    mods: { combate: 2, mobilidade: 3, vigor: 1, intelecto: 0, carisma: 1 },
    pericias: ["Enganação", "Intimidação", "Percepção", "Furtividade"]
  },
  {
    login: "helena",
    name: "Helena Lima",
    foto: "assets/helena-lima.png",
    especialidade: "Artista marcial",
    hpMax: 113, hpCurrent: 113,
    loggedIn: false,
    dispatchStatus: "offline",
    mods: { combate: 1, mobilidade: 4, vigor: 4, intelecto: 0, carisma: 2 },
    pericias: ["Acrobacia", "Atletismo", "Medicina", "Performance"]
  },
  {
    login: "victor",
    name: "Victor Bergmann",
    foto: "assets/victor-bergmann.png",
    especialidade: "Telecinese",
    hpMax: 121, hpCurrent: 121,
    loggedIn: false,
    dispatchStatus: "offline",
    mods: { combate: -1, mobilidade: -1, vigor: 3, intelecto: 5, carisma: 5 },
    pericias: ["Arcana", "Enganação", "História", "Investigação", "Percepção", "Persuasão"]
  },
  {
    login: "damadeprata",
    name: "Dama de Prata",
    foto: "assets/dama-de-prata.png",
    especialidade: "Transmutação em mercúrio",
    hpMax: 165, hpCurrent: 165,
    loggedIn: false,
    dispatchStatus: "offline",
    mods: { combate: 3, mobilidade: 6, vigor: 3, intelecto: 1, carisma: 3 },
    pericias: ["Acrobacia", "Furtividade", "Percepção"]
  },
  {
    login: "sara",
    name: "Sara",
    foto: "assets/sara.png",
    especialidade: "Sorte (tipo Domino, da Marvel)",
    hpMax: 104, hpCurrent: 104,
    loggedIn: false,
    dispatchStatus: "offline",
    mods: { combate: 0, mobilidade: 5, vigor: 3, intelecto: 1, carisma: 4 },
    pericias: ["História", "Intuição", "Natureza", "Percepção", "Sobrevivência"]
  },
  {
    login: "forjaceu",
    name: "Forja-Céu",
    foto: "assets/forja-ceu.png",
    especialidade: "Super resistência e força",
    hpMax: 210, hpCurrent: 210,
    loggedIn: false,
    dispatchStatus: "offline",
    mods: { combate: 7, mobilidade: 0, vigor: 6, intelecto: 2, carisma: 1 },
    pericias: ["Atletismo", "Intuição"]
  },
  {
    login: "filon",
    name: "Fílon",
    foto: "assets/filon.png",
    especialidade: "Controle de fios",
    hpMax: 150, hpCurrent: 150,
    loggedIn: false,
    dispatchStatus: "offline",
    mods: { combate: 1, mobilidade: 4, vigor: 3, intelecto: 5, carisma: 4 },
    pericias: ["Acrobacia", "Investigação", "Percepção", "Prestidigitação"]
  },
  {
    login: "polux",
    name: "Pólux",
    foto: "assets/pólux.png",
    especialidade: "Controle de energia radioativa",
    hpMax: 185, hpCurrent: 185,
    loggedIn: false,
    dispatchStatus: "offline",
    mods: { combate: 5, mobilidade: 2, vigor: 1, intelecto: 5, carisma: 3 },
    pericias: ["Arcana", "Intuição", "Prestidigitação"]
  }
];

// Tipos de missão: status primário/secundário (chaves de "mods") + perícias relevantes.
// "complications": os 3 modelos de opção da fase de complicação (nessa ordem fixa).
// As duas primeiras usam status brutos; a terceira ("requiresPericia") é a
// abordagem especializada — só compensa de verdade se algum agente despachado
// tiver a perícia sorteada entre as listadas em "pericias".
const MISSION_TYPES = [
  {
    id: "combate", label: "Combate Direto", primary: "combate", secondary: "vigor",
    pericias: ["Atletismo", "Intimidação"],
    complications: [
      { label: "Confronto direto, força contra força", statKey: "combate" },
      { label: "Resistir e desgastar o alvo até ele ceder", statKey: "vigor" },
      { label: "Explorar uma brecha no padrão de ataque do alvo", statKey: "combate", requiresPericia: true }
    ]
  },
  {
    id: "contencao", label: "Contenção", primary: "combate", secondary: "vigor",
    pericias: ["Atletismo", "Intimidação", "Percepção"],
    complications: [
      { label: "Imobilizar o alvo pela força", statKey: "combate" },
      { label: "Cercar e aguentar até a rendição", statKey: "vigor" },
      { label: "Prever o próximo movimento e cortar a rota de fuga", statKey: "combate", requiresPericia: true }
    ]
  },
  {
    id: "investigacao", label: "Investigação", primary: "intelecto", secondary: "carisma",
    pericias: ["Investigação", "Intuição", "Percepção", "Arcana", "História"],
    complications: [
      { label: "Analisar as evidências com lógica fria", statKey: "intelecto" },
      { label: "Conversar com testemunhas e conquistar confiança", statKey: "carisma" },
      { label: "Conectar um detalhe que só um especialista notaria", statKey: "intelecto", requiresPericia: true }
    ]
  },
  {
    id: "sabotagem", label: "Sabotagem", primary: "intelecto", secondary: "mobilidade",
    pericias: ["Furtividade", "Prestidigitação", "Investigação"],
    complications: [
      { label: "Planejar a sabotagem nos mínimos detalhes", statKey: "intelecto" },
      { label: "Infiltrar-se rápido, antes que alguém perceba", statKey: "mobilidade" },
      { label: "Driblar o sistema de segurança com precisão cirúrgica", statKey: "intelecto", requiresPericia: true }
    ]
  },
  {
    id: "extracao", label: "Extração", primary: "mobilidade", secondary: "vigor",
    pericias: ["Acrobacia", "Atletismo", "Furtividade"],
    complications: [
      { label: "Extração rápida, sem parar pra pensar", statKey: "mobilidade" },
      { label: "Carregar o alvo à força pelo caminho mais direto", statKey: "vigor" },
      { label: "Encontrar a rota de fuga perfeita", statKey: "mobilidade", requiresPericia: true }
    ]
  },
  {
    id: "vigilancia", label: "Vigilância", primary: "intelecto", secondary: "mobilidade",
    pericias: ["Percepção", "Furtividade", "Intuição"],
    complications: [
      { label: "Analisar padrões de movimento à distância", statKey: "intelecto" },
      { label: "Reposicionar-se furtivamente pra um ângulo melhor", statKey: "mobilidade" },
      { label: "Notar o detalhe que ninguém mais perceberia", statKey: "intelecto", requiresPericia: true }
    ]
  },
  {
    id: "escolta", label: "Escolta", primary: "vigor", secondary: "combate",
    pericias: ["Atletismo", "Intuição", "Percepção"],
    complications: [
      { label: "Formar um escudo humano ao redor do alvo", statKey: "vigor" },
      { label: "Neutralizar ameaças antes que cheguem perto", statKey: "combate" },
      { label: "Antecipar a emboscada antes que ela aconteça", statKey: "vigor", requiresPericia: true }
    ]
  },
  {
    id: "resgate", label: "Resgate", primary: "mobilidade", secondary: "vigor",
    pericias: ["Acrobacia", "Atletismo", "Medicina", "Sobrevivência"],
    complications: [
      { label: "Correr contra o tempo até o alvo", statKey: "mobilidade" },
      { label: "Aguentar as condições adversas até o fim", statKey: "vigor" },
      { label: "Estabilizar o resgatado com conhecimento técnico", statKey: "mobilidade", requiresPericia: true }
    ]
  }
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

const MOD_LABELS = { combate: "COM", mobilidade: "MOB", vigor: "VIG", intelecto: "INT", carisma: "CAR" };

// ---------- Funções de cálculo ----------

// Status de saúde derivado só do PV (independe de estar em campo ou não).
function healthStatus(agent) {
  if (agent.hpCurrent <= 0) return "incapacitado";
  if (agent.hpCurrent / agent.hpMax < 0.6) return "ferido";
  return "saudavel";
}

function combinedStatus(agent) {
  if (
    typeof sdnIsAgentLoggedIn === "function" &&
    !sdnIsAgentLoggedIn(agent.login)
  ) {
    return "offline";
  }

  if (agent.dispatchStatus === "campo") return "campo";
  if (agent.dispatchStatus === "descansando") return "descansando";

  return healthStatus(agent);
}

function canBeDispatched(agent) {
  if (!agent.loggedIn) return false;

  return (
    agent.dispatchStatus === "disponivel" &&
    healthStatus(agent) !== "incapacitado"
  );
}

function statusLabel(status) {
  return {
    saudavel: "DISPONÍVEL",
    ferido: "FERIDO",
    campo: "EM CAMPO",
    descansando: "DESCANSANDO",
    incapacitado: "INCAPACITADO",
    offline: "OFFLINE"
  }[status] || status.toUpperCase();
}

function threatLabel(value) {
  const t = THREAT_LEVELS.find((t) => t.value === value);
  return t ? t.label : value;
}

function computeScore(agent, missionTypeId, recommendedSkills = null) {
  const mt = MISSION_TYPES.find((m) => m.id === missionTypeId);
  if (!mt) return 0;

  const primaryMod = agent.mods[mt.primary] ?? 0;
  const secondaryMod = agent.mods[mt.secondary] ?? 0;

  const relevantSkills = Array.isArray(recommendedSkills) && recommendedSkills.length
    ? recommendedSkills
    : mt.pericias;

  const matches = agent.pericias.filter((p) =>
    relevantSkills.includes(p)
  ).length;

  return primaryMod * 2
    + secondaryMod
    + matches * PROFICIENCY_BONUS;
}

function missionTypeById(id) {
  return MISSION_TYPES.find((m) => m.id === id);
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---------- Fase de complicação (estilo "Dispatch") ----------

// Força coletiva em um atributo: o melhor agente lidera, e os demais
// complementam 35% da média deles. Assim, cada integrante tem impacto sem
// transformar uma equipe grande numa garantia automática de sucesso.
function teamStatPower(agents, statKey) {
  if (!agents.length) return 0;
  const values = agents.map((a) => Math.max(0, a.mods[statKey] ?? 0)).sort((a, b) => b - a);
  const leader = values[0];
  const supportAverage = values.length > 1
    ? values.slice(1).reduce((sum, value) => sum + value, 0) / (values.length - 1)
    : 0;
  return Math.min(8, leader + supportAverage * 0.35);
}

// Fórmula única usada tanto no painel prévio quanto nas decisões da missão.
// Chance = base + atributo principal coletivo + apoio coletivo + perícias +
//          coordenação do grupo − risco. O resultado é limitado a 5–95%.
function calculateMissionChance(agents, missionTypeId, threat, option = {}) {
  if (!agents.length) return 0;

  const mt = missionTypeById(missionTypeId);

  const primaryKey = option.statKey || mt.primary;
  const supportKey = primaryKey === mt.primary
    ? mt.secondary
    : mt.primary;

  const primary = teamStatPower(agents, primaryKey);
  const support = teamStatPower(agents, supportKey);

  const relevantSkills =
    option.requiresPericia && option.pericia
      ? [option.pericia]
      : (
          Array.isArray(option.periciasRecomendadas) &&
          option.periciasRecomendadas.length
            ? option.periciasRecomendadas
            : mt.pericias
        );

  const skilledAgents = agents.filter((a) =>
    a.pericias.some((p) => relevantSkills.includes(p))
  ).length;

  const skillBonus = Math.min(12, skilledAgents * 4);

  const coordinationBonus = Math.min(
    8,
    Math.max(0, agents.length - 1) * 3
  );

  const riskPenalty = {
    baixa: 20,
    media: 32,
    alta: 44,
    critica: 56
  }[threat] ?? 32;

  const chance =
    25
    + primary * 8
    + support * 5
    + skillBonus
    + coordinationBonus
    - riskPenalty;

  return Math.max(
    5,
    Math.min(95, Math.round(chance))
  );
}

// Gera as opções da complicação para uma missão + equipe despachada.
// Se a missão tiver complicacaoCustom.opcoes, usa elas (com o texto e o
// modificador escritos pelo mestre); senão cai nas 3 opções genéricas
// do tipo da missão, como antes.
function buildComplicationOptions(mission, agents) {
  const custom = mission.complicacaoCustom;
  if (custom && Array.isArray(custom.opcoes) && custom.opcoes.length) {
    return custom.opcoes.map((op, i) => {
      const baseChance = calculateMissionChance(agents, mission.type, mission.threat, { statKey: op.atributoChave });
      const modifier = Number(op.modificadorChance) || 0;
      const chance = Math.max(5, Math.min(95, Math.round(baseChance + modifier)));
      return {
        key: op.id || `custom-${i}`,
        label: op.texto,
        statKey: op.atributoChave,
        requiresPericia: false,
        pericia: null,
        special: modifier > 0,
        risky: modifier < 0,
        chance
      };
    });
  }

  const mt = missionTypeById(mission.type);
  return mt.complications.map((tmpl, i) => {
    const pericia = tmpl.requiresPericia ? pick(mt.pericias) : null;
    const chance = calculateMissionChance(agents, mission.type, mission.threat, {
      statKey: tmpl.statKey,
      requiresPericia: !!tmpl.requiresPericia,
      pericia
    });
    return {
      key: ["a", "b", "c"][i],
      label: tmpl.label,
      statKey: tmpl.statKey,
      requiresPericia: !!tmpl.requiresPericia,
      pericia,
      special: !!tmpl.requiresPericia,
      risky: false,
      chance
    };
  });
}

// Sorteia o resultado (1–100) contra a chance de sucesso da opção escolhida.
function rollOutcome(chancePercent) {
  const roll = Math.floor(Math.random() * 100) + 1;
  return { roll, success: roll <= chancePercent };
}

// Perfil de exigência (5 eixos) usado só pro desenho do radar no modal.
// Se a missão tiver exigenciasAtributos (vindo do pool ou do painel do
// mestre), usa exatamente esses valores. Senão, deriva um perfil
// genérico a partir do tipo + risco da missão (status primário pesa
// mais, secundário pesa médio, o resto fica num piso baixo).
function getRequiredProfile(mission) {
  if (mission.exigenciasAtributos) return mission.exigenciasAtributos;
  const mt = missionTypeById(mission.type);
  const threatFactor = { baixa: 0.7, media: 1, alta: 1.3, critica: 1.6 }[mission.threat] ?? 1;
  const axes = ["combate", "mobilidade", "vigor", "intelecto", "carisma"];
  const profile = {};
  axes.forEach((axis) => {
    let base = 1;
    if (axis === mt.primary) base = 6;
    else if (axis === mt.secondary) base = 3.5;
    profile[axis] = Math.round(base * threatFactor * 10) / 10;
  });
  return profile;
}

// ---------- Gráfico radar (SVG) ----------
// Desenha o pentágono de status de um agente. Usa variáveis CSS do tema,
// então só funciona corretamente quando inserido no DOM da página (herda
// as custom properties do :root).
function renderRadarSVG(agent, size = 170) {
  const axes = ["combate", "mobilidade", "vigor", "intelecto", "carisma"];
  const center = size / 2;
  const radius = size * 0.36;
  const minV = -2, maxV = 8; // faixa assumida pra normalizar os modificadores
  const angleStep = (Math.PI * 2) / axes.length;

  const norm = (v) => Math.max(0, Math.min(1, (v - minV) / (maxV - minV)));

  const pointAt = (i, r) => {
    const angle = -Math.PI / 2 + i * angleStep;
    return [center + r * Math.cos(angle), center + r * Math.sin(angle)];
  };

  const outer = axes.map((_, i) => pointAt(i, radius).join(",")).join(" ");
  const shape = axes.map((key, i) => pointAt(i, radius * norm(agent.mods[key] ?? 0)).join(",")).join(" ");
  const labels = axes.map((key, i) => {
    const [x, y] = pointAt(i, radius + 14);
    return `<text x="${x}" y="${y}" font-size="9" fill="var(--text-dim)" text-anchor="middle" dominant-baseline="middle">${MOD_LABELS[key]}</text>`;
  }).join("");

  return `
    <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="Gráfico de status">
      <polygon points="${outer}" fill="none" stroke="var(--green-faint)" stroke-width="1"></polygon>
      <polygon points="${shape}" fill="rgba(61,255,122,0.35)" stroke="var(--green)" stroke-width="2"></polygon>
      ${labels}
    </svg>
  `;
}
