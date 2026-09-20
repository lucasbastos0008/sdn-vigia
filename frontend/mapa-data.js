/* ===== SDN-VIGIA — Coordenadas do mapa ===== *
   Posições em porcentagem (x = da esquerda, y = do topo) sobre a
   imagem assets/mapa-cidade.png. São chutes visuais razoáveis pra
   distribuir os locais pela imagem — ajuste os números à vontade
   pra encaixar em pontos específicos do seu mapa. */

const HQ_POSITION = { x: 51, y: 15 }; // o edifício redondo (arena) perto do topo

const LOCATION_POSITIONS = {
  "Distrito Portuário":        { x: 10, y: 24 },
  "Torre Aurora":              { x: 78, y: 11 },
  "Metrô — Linha 4":           { x: 51, y: 37 },
  "Complexo Industrial Norte": { x: 89, y: 6 },
  "Ponte Vytal":               { x: 26, y: 14 },
  "Universidade Central":      { x: 36, y: 34 },
  "Represa Elysium":           { x: 82, y: 63 },
  "Estação Baixa Órbita":      { x: 71, y: 44 },
  "Zona Ribeirinha":           { x: 4, y: 40 },
  "Central de Energia 7":      { x: 80, y: 16 },
  "Bairro Marlowe":            { x: 14, y: 76 },
  "Túneis do Setor 9":         { x: 86, y: 84 }
};

// Posição estável (não-aleatória a cada render) pra locais que não
// estão no dicionário acima — útil pra missões inseridas manualmente
// com um nome de local que você inventou na hora.
function getLocationPosition(name) {
  if (LOCATION_POSITIONS[name]) return LOCATION_POSITIONS[name];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return {
    x: 15 + (hash % 70),
    y: 20 + ((hash >> 8) % 60)
  };
}