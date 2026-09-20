/* ===== SDN-VIGIA — Pool de Missões Pré-Criadas =====
   Edite esta lista com suas próprias missões antes da sessão, na
   ORDEM em que você quer que elas apareçam na mesa.

   O ritmo de chegada é automático e fixo (configurável em TIMING, no
   data.js): a primeira missão aparece assim que o dispatcher.html é
   aberto; cada próxima aparece um intervalo fixo depois da anterior
   ter aparecido (não da anterior ter terminado).

   Este é o MESMO schema usado pelo Painel do Mestre (mestre.html) —
   uma missão pode vir tanto daqui quanto de lá, sem diferença.

   Campos:
   - id: identificador único (string)
   - titulo: código da operação, o que aparece na fila
   - tipo: "combate" | "contencao" | "investigacao" | "sabotagem" |
           "extracao" | "vigilancia" | "escolta" | "resgate"
   - risco: "baixa" | "media" | "alta" | "critica"
   - local: texto livre
   - vagasMaximas (opcional): quantos agentes cabem nesta missão —
     se omitido, usa o padrão por risco (baixa/média=2, alta=3, crítica=4)
   - duracaoMinutos (opcional): minutos até a complicação surgir depois
     do despacho — se omitido, usa TIMING.complicationDelayMin
   - chamadoCliente: { solicitante, avatarSolicitante (opcional), mensagem }
     — a ficha rasa do chamado. Aparece pro dispatcher E, resumida, pros
     jogadores (é a única parte da missão que não fica "classificada").
   - requisitosTaticos: [ "...", "..." ] — bullets com o que precisa ser
     feito. Só o dispatcher vê.
   - exigenciasAtributos (opcional): { combate, mobilidade, vigor,
     intelecto, carisma } — os 5 valores que desenham o pentágono
     vermelho de exigência no modal. Se omitido, o sistema deriva um
     perfil genérico a partir do tipo da missão.
   - complicacaoCustom (opcional): { titulo, descricao, opcoes: [
       { id, texto, atributoChave, modificadorChance } ] } — substitui
     as 3 opções genéricas do tipo por opções escritas por você.
     "modificadorChance" é um ajuste em pontos percentuais (+/-) somado
     à chance calculada pra aquela opção.
   - nota (opcional): lembrete só seu, não aparece em lugar nenhum

   Os dois abaixo são EXEMPLOS — substitua pelas suas missões reais,
   na ordem em que quer que elas cheguem. */

const MISSION_POOL = [
  {
  id: "m01",

  titulo: "OPERAÇÃO CINZA",

  tipo: "investigacao",

  risco: "media",

  local: "Universidade Central",

  apareceEmMinutos: 0,

  vagasMaximas: 2,

  duracaoMinutos: 4,

  chamadoCliente: {
    solicitante: "Segurança / Universidade Central",
    avatarSolicitante: "",
    mensagem: "Encontramos movimentações suspeitas no bloco C."
  },

  requisitosTaticos: [
    "Investigar o esconderijo no bloco C.",
    "Identificar quem está utilizando o local.",
    "Recuperar qualquer evidência encontrada."
  ],

  periciasRecomendadas: [
    "Investigação",
    "Percepção",
    "Furtividade"
  ],

  exigenciasAtributos: {
    combate: 2,
    mobilidade: 4,
    vigor: 2,
    intelecto: 7,
    carisma: 3
  },

  complicacaoCustom: {
    titulo: "ALARME SILENCIOSO ATIVADO",

    descricao: "Um sistema de segurança detecta a presença dos agentes.",

    opcoes: [
      {
        id: "opt_1",
        texto: "Desativar o sistema",
        atributoChave: "intelecto",
        modificadorChance: 15
      },
      {
        id: "opt_2",
        texto: "Sair rapidamente do local",
        atributoChave: "mobilidade",
        modificadorChance: 5
      },
      {
        id: "opt_3",
        texto: "Destruir o equipamento",
        atributoChave: "combate",
        modificadorChance: -10
      }
    ]
  },

  nota: "A investigação deve começar parecendo um chamado comum."
}
];