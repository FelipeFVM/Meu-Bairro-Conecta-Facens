// Dados base do protótipo "Meu Bairro Conecta — Campus Facens".
// Coordenadas em % sobre a ilustração do campus (assets/mapa-facens.webp, 1600x918).
// Prédios A–L e portarias 1 e 2 conforme o mapa de blocos do campus.

const MAPA = {
  largura: 1600,
  altura: 918,
  metrosPorPixel: 0.45, // escala aproximada do campus na ilustração
};

const CATEGORIAS = {
  buraco:         { nome: "Buraco / pavimento",          icone: "🕳️", cor: "#c2410c" },
  iluminacao:     { nome: "Falta de iluminação",         icone: "💡", cor: "#b45309" },
  acessibilidade: { nome: "Acessibilidade",              icone: "♿", cor: "#2563eb" },
  calcada:        { nome: "Calçada / passeio",           icone: "🚶", cor: "#7c3aed" },
  alagamento:     { nome: "Alagamento",                  icone: "🌧️", cor: "#0e7490" },
  estacionamento: { nome: "Estacionamento",              icone: "🅿️", cor: "#475569" },
  sinalizacao:    { nome: "Sinalização / travessia",     icone: "🚸", cor: "#dc2626" },
  bicicleta:      { nome: "Bicicleta / micromobilidade", icone: "🚲", cor: "#15803d" },
  transporte:     { nome: "Transporte / ônibus",         icone: "🚌", cor: "#0f766e" },
  limpeza:        { nome: "Lixo / limpeza",              icone: "🗑️", cor: "#4d7c0f" },
};

const STATUS = {
  pendente:  { nome: "Pendente",   cor: "#dc2626" },
  analise:   { nome: "Em análise", cor: "#d97706" },
  resolvido: { nome: "Resolvido",  cor: "#16a34a" },
};

// Pontos de referência do campus (camada "Locais").
const LOCAIS = [
  { id: "portaria1",   nome: "Portaria 1",               x: 59.1, y: 85.4, tipo: "acesso" },
  { id: "portaria2",   nome: "Portaria 2",               x: 19.4, y: 47.5, tipo: "acesso" },
  { id: "predio-a",    nome: "Prédio A",                 x: 58.4, y: 66.2, tipo: "predio" },
  { id: "predio-b",    nome: "Prédio B",                 x: 57.4, y: 42.0, tipo: "predio" },
  { id: "predio-c",    nome: "Prédio C",                 x: 45.1, y: 32.7, tipo: "predio" },
  { id: "predio-d",    nome: "Prédio D",                 x: 37.6, y: 39.2, tipo: "predio" },
  { id: "predio-e",    nome: "Prédio E",                 x: 53.4, y: 52.3, tipo: "predio" },
  { id: "predio-f",    nome: "Prédio F",                 x: 39.0, y: 57.5, tipo: "servico" },
  { id: "predio-g",    nome: "Prédio G",                 x: 27.5, y: 54.5, tipo: "predio" },
  { id: "predio-h",    nome: "Prédio H",                 x: 40.1, y: 64.3, tipo: "predio" },
  { id: "predio-i",    nome: "Prédio I",                 x: 89.9, y: 71.5, tipo: "predio" },
  { id: "predio-j",    nome: "Prédio J",                 x: 76.9, y: 35.3, tipo: "predio" },
  { id: "predio-k",    nome: "Prédio K",                 x: 67.4, y: 25.7, tipo: "predio" },
  { id: "predio-l",    nome: "Prédio L (Facens)",        x: 83.5, y: 52.0, tipo: "predio" },
  { id: "campo",       nome: "Campo de futebol",         x: 20.5, y: 80.5, tipo: "lazer" },
  { id: "lago",        nome: "Lago",                     x: 22.0, y: 34.0, tipo: "lazer" },
  { id: "trem",        nome: "Linha do monotrilho",      x: 27.0, y: 24.0, tipo: "transporte" },
  { id: "pista-aero",  nome: "Área de aerodesign",       x: 65.0, y: 51.5, tipo: "lazer" },
  { id: "est-sul",     nome: "Estacionamento sul",       x: 39.5, y: 87.0, tipo: "estacionamento" },
  { id: "est-leste",   nome: "Estacionamento leste",     x: 77.0, y: 80.0, tipo: "estacionamento" },
  { id: "est-norte",   nome: "Estacionamento norte",     x: 62.0, y: 34.5, tipo: "estacionamento" },
  { id: "est-centro",  nome: "Estacionamento central",   x: 64.0, y: 74.0, tipo: "estacionamento" },
  { id: "mastros",     nome: "Praça dos mastros",        x: 69.5, y: 68.0, tipo: "lazer" },
];

// Ocorrências e sugestões iniciais (dados fictícios para demonstração).
// diasAtras / confirmadoHa são convertidos em datas reais na primeira execução.
const SEED = [
  { tipo: "problema", cat: "buraco", titulo: "Buraco no anel viário perto da Portaria 1", desc: "Buraco grande logo após a cancela de entrada, sentido estacionamento central. Carros desviam pela contramão.", x: 61.5, y: 80.0, status: "pendente", diasAtras: 6, confirmadoHa: 0, confirmacoes: 23 },
  { tipo: "problema", cat: "iluminacao", titulo: "Caminho do lago sem iluminação", desc: "Os postes do caminho entre o lago e o Prédio D estão apagados. À noite (saída das 22h40) fica totalmente escuro.", x: 30.0, y: 38.0, status: "analise", diasAtras: 12, confirmadoHa: 1, confirmacoes: 31 },
  { tipo: "problema", cat: "alagamento", titulo: "Alagamento no estacionamento sul", desc: "Em dias de chuva forte acumula água entre as vagas do meio. Difícil sair do carro sem molhar os pés.", x: 41.5, y: 89.5, status: "pendente", diasAtras: 3, confirmadoHa: 0, confirmacoes: 14 },
  { tipo: "problema", cat: "acessibilidade", titulo: "Falta rampa na calçada do Prédio F (ambulatório)", desc: "Cadeirantes precisam dar a volta pela rua para chegar à porta do ambulatório (Prédio F).", x: 38.5, y: 60.5, status: "pendente", diasAtras: 20, confirmadoHa: 2, confirmacoes: 18 },
  { tipo: "problema", cat: "sinalizacao", titulo: "Faixa de pedestre apagada", desc: "A faixa que liga o estacionamento central aos prédios A e E está quase invisível.", x: 60.0, y: 70.5, status: "pendente", diasAtras: 9, confirmadoHa: 3, confirmacoes: 12 },
  { tipo: "problema", cat: "estacionamento", titulo: "Carros parados em vaga de idoso/PcD", desc: "Recorrente no horário das 19h no estacionamento leste.", x: 78.5, y: 82.0, status: "analise", diasAtras: 15, confirmadoHa: 4, confirmacoes: 9 },
  { tipo: "problema", cat: "calcada", titulo: "Calçada quebrada no Prédio H", desc: "Placas de concreto soltas na entrada lateral, risco de tropeço.", x: 33.5, y: 72.0, status: "pendente", diasAtras: 40, confirmadoHa: 36, confirmacoes: 5 },
  { tipo: "problema", cat: "limpeza", titulo: "Lixeiras cheias perto do campo", desc: "Depois dos jogos de quinta as lixeiras transbordam até segunda.", x: 26.0, y: 74.0, status: "resolvido", diasAtras: 25, confirmadoHa: 18, confirmacoes: 7 },
  { tipo: "problema", cat: "transporte", titulo: "Ponto de ônibus sem cobertura", desc: "O ponto em frente à Portaria 1 não tem abrigo; em dia de chuva todo mundo se espreme embaixo da guarita.", x: 55.0, y: 93.0, status: "pendente", diasAtras: 8, confirmadoHa: 1, confirmacoes: 27 },
  { tipo: "sugestao", cat: "bicicleta", titulo: "Bicicletário coberto na Portaria 1", desc: "Instalar um bicicletário coberto com tomada para patinetes elétricos ao lado da Portaria 1, incentivando a mobilidade ativa.", x: 64.5, y: 88.0, status: "analise", diasAtras: 18, confirmadoHa: 0, confirmacoes: 42 },
  { tipo: "sugestao", cat: "acessibilidade", titulo: "Piso tátil do estacionamento aos blocos", desc: "Rota acessível contínua com piso tátil e rampas ligando o estacionamento sul ao Prédio A.", x: 46.0, y: 79.0, status: "pendente", diasAtras: 11, confirmadoHa: 2, confirmacoes: 19 },
  { tipo: "sugestao", cat: "sinalizacao", titulo: "Faixa elevada no anel viário", desc: "Faixa de pedestre elevada (lombofaixa) no cruzamento entre a área de aerodesign e o Prédio L para reduzir velocidade.", x: 70.0, y: 49.5, status: "pendente", diasAtras: 5, confirmadoHa: 0, confirmacoes: 16 },
  { tipo: "sugestao", cat: "iluminacao", titulo: "Postes solares no caminho do campo", desc: "Aproveitar a experiência do Prédio D (painéis solares) e instalar postes LED com painel solar no caminho até o campo de futebol.", x: 27.5, y: 66.0, status: "pendente", diasAtras: 14, confirmadoHa: 5, confirmacoes: 11 },
  { tipo: "sugestao", cat: "estacionamento", titulo: "Vagas com recarga para veículos elétricos", desc: "Reservar 4 vagas do estacionamento leste com carregadores para carros elétricos e híbridos.", x: 75.0, y: 77.0, status: "pendente", diasAtras: 22, confirmadoHa: 6, confirmacoes: 13 },
  { tipo: "sugestao", cat: "transporte", titulo: "Painel com horário dos ônibus na Portaria 1", desc: "Tela com previsão de chegada das linhas que atendem a Facens, integrada ao app.", x: 57.5, y: 82.5, status: "pendente", diasAtras: 2, confirmadoHa: 0, confirmacoes: 8 },
];

// Ocorrência usada para demonstrar as notificações (aparece alguns segundos após abrir o app).
const OCORRENCIA_DEMO = {
  tipo: "problema", cat: "alagamento", titulo: "Poça grande na saída do estacionamento central",
  desc: "Registrado agora por outro aluno: água acumulada na saída para o anel viário.",
  x: 62.5, y: 77.5, status: "pendente", confirmacoes: 1, autor: "Outro aluno",
};

// ---------------------------------------------------------------- GPS
// Pontos de controle: coordenadas reais (OpenStreetMap) ↔ posição na ilustração (%).
// A ilustração não está em escala; o app combina uma transformação afim (mínimos
// quadrados) com uma correção local por distância inversa, de modo que cada ponto
// de controle cai exatamente sobre o prédio correspondente.
const GPS_PONTOS = [
  { nome: "Prédio A",   lat: -23.470723, lng: -47.428874, x: 58.4, y: 66.2 },
  { nome: "Prédio B",   lat: -23.469752, lng: -47.429306, x: 57.4, y: 42.0 },
  { nome: "Prédio C",   lat: -23.469419, lng: -47.429974, x: 45.1, y: 32.7 },
  { nome: "Prédio D",   lat: -23.469697, lng: -47.430367, x: 37.6, y: 39.2 },
  { nome: "Prédio E",   lat: -23.470363, lng: -47.429291, x: 53.4, y: 52.3 },
  { nome: "Prédio L",   lat: -23.470152, lng: -47.428022, x: 83.5, y: 52.0 },
  { nome: "Prédio I",   lat: -23.470464, lng: -47.427526, x: 89.9, y: 71.5 },
  { nome: "Portaria 1", lat: -23.471000, lng: -47.428450, x: 59.1, y: 85.4 },
  { nome: "Portaria 2", lat: -23.470780, lng: -47.431100, x: 19.4, y: 47.5 },
  { nome: "Lago",       lat: -23.470338, lng: -47.431501, x: 22.0, y: 34.0 },
];

// Limites aproximados do campus (OpenStreetMap) e margem para considerar "dentro do campus".
const CAMPUS = {
  sul: -23.472289, norte: -23.468815, oeste: -47.431672, leste: -47.427325,
  margemM: 80,
  raioAlertaProximidadeM: 30, // alerta em tempo real ao se aproximar de um problema ativo
};
