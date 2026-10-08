// URL pública da aba "Respostas" exportada como CSV pelo Google Sheets
const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRVpZ_M7Dt_kTC-gSUoL7saEfC3RFe-VfiKV4mPHlBntir_NUh9NU2xUbqcPJUnEreDxjGHjiHU4d7E/pub?gid=2120332944&single=true&output=csv";

/**
 * Parser de CSV compatível com campos contendo aspas e múltiplas linhas
 */
function parseCSV(text) {
  const linhas = [];
  let linhaAtual = [];
  let valorAtual = '';
  let dentroDeAspas = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const prox = text[i + 1];

    if (c === '"') {
      if (dentroDeAspas && prox === '"') {
        valorAtual += '"';
        i++;
      } else {
        dentroDeAspas = !dentroDeAspas;
      }
    } else if (c === ',' && !dentroDeAspas) {
      linhaAtual.push(valorAtual.trim());
      valorAtual = '';
    } else if ((c === '\r' || c === '\n') && !dentroDeAspas) {
      if (c === '\r' && prox === '\n') i++;
      linhaAtual.push(valorAtual.trim());
      if (linhaAtual.length > 1 || linhaAtual[0] !== '') {
        linhas.push(linhaAtual);
      }
      linhaAtual = [];
      valorAtual = '';
    } else {
      valorAtual += c;
    }
  }
  if (valorAtual || linhaAtual.length > 0) {
    linhaAtual.push(valorAtual.trim());
    linhas.push(linhaAtual);
  }
  return linhas;
}

/**
 * Interpreta linhas em múltiplos formatos:
 * - "Nome, 1,5km, https://..."
 * - "Nome, 500m, https://..."
 * - "Nome, https://..."
 * - "Nome: https://..."
 * - "Nome - 1.5 km - https://..."
 */
function extrairDadosLocal(linhaTexto) {
  if (!linhaTexto || !linhaTexto.trim()) return null;

  // 1. Extrai a URL do Maps (http/https)
  const urlMatch = linhaTexto.match(/(https?:\/\/[^\s,;]+)/i);
  const linkUrl = urlMatch ? urlMatch[0] : null;

  // 2. Remove o link e marcadores de lista (*, -, •, números)
  let textoRestante = linhaTexto.replace(linkUrl || '', '')
                                .replace(/^[\s•\-\*\d\.\)\:]+/, '')
                                .trim();

  // 3. Captura distâncias (ex: 500m, 1,5km, 2.6 km, 800 m)
  const regexDistancia = /(?:,\s*|\s*-\s*|\s*\|\s*|\s+)(\d+(?:[.,]\d+)?\s*(?:km|m))\b/i;
  const matchDistancia = textoRestante.match(regexDistancia);

  let distancia = null;
  let nome = textoRestante;

  if (matchDistancia) {
    distancia = matchDistancia[1].trim();
    // O nome é o que estiver antes do trecho da distância
    nome = textoRestante.substring(0, matchDistancia.index).trim();
  }

  // Limpa pontuações que sobraram no final do nome
  nome = nome.replace(/[\,\:\-\|]+$/, '').trim();

  if (!nome && linkUrl) {
    nome = "Local Recomendado";
  }

  return {
    nome: nome || "Local Recomendado",
    distancia: distancia,
    url: linkUrl
  };
}

async function carregarDadosAcomodacao() {
  const urlParams = new URLSearchParams(window.location.search);
  const idProcurado = urlParams.get('id');

  if (!idProcurado) {
    mostrarMensagem("Atenção", "Por favor, utilize o link exclusivo fornecido para a sua reserva.");
    return;
  }

  try {
    const res = await fetch(CSV_URL);
    const csvTexto = await res.text();
    const matriz = parseCSV(csvTexto);

    if (matriz.length < 2) return;

    // Normaliza cabeçalhos da planilha
    const cabecalho = matriz[0].map(col => col.toLowerCase().trim());
    const idIdx = cabecalho.indexOf('id');

    // Localiza a linha do imóvel pelo ID
    const linha = matriz.slice(1).find(row => {
      const celulaId = (row[idIdx] || '').trim();
      return celulaId === idProcurado.trim() || celulaId.startsWith(idProcurado.trim());
    });

    if (!linha) {
      mostrarMensagem("Acomodação não encontrada", "Não encontramos nenhum manual com este identificador.");
      return;
    }

    // Mapeia colunas para o objeto de dados
    const dados = {};
    cabecalho.forEach((col, idx) => {
      dados[col] = linha[idx] || '';
    });

    // Validação de publicação
    if (dados.status !== 'PUBLICADO') {
      mostrarMensagem("Guia em Preparação", "O manual desta acomodação ainda está sendo aprovado e configurado pelo anfitrião.");
      return;
    }

    // 1. Título e Header
    document.title = `${dados.accommodation_name || 'Manual'} | Guia do Hóspede`;
    const elNomeAcomodacao = document.getElementById('nome-acomodacao');
    if (elNomeAcomodacao && dados.accommodation_name) {
      elNomeAcomodacao.textContent = dados.accommodation_name;
    }

    // 2. Wi-Fi
    const elWifiSsid = document.getElementById('wifi-ssid');
    const elWifiPass = document.getElementById('wifi-pass');
    if (elWifiSsid && dados.wifi_ssid) elWifiSsid.textContent = dados.wifi_ssid;
    if (elWifiPass && dados.wifi_pass) elWifiPass.textContent = dados.wifi_pass;

    // 3. Botão WhatsApp Host
    const elBtnWhats = document.getElementById('btn-whatsapp');
    if (elBtnWhats && dados.host_whatsapp) {
      const telDigitos = dados.host_whatsapp.replace(/\D/g, '');
      const ddiTel = telDigitos.startsWith('55') ? telDigitos : `55${telDigitos}`;
      const nomeHost = dados.host_name || 'Host';
      elBtnWhats.href = `https://wa.me/${ddiTel}?text=Ol%C3%A1%2C%20${encodeURIComponent(nomeHost)}!%20Sou%20h%C3%B3spede%20do%20Airbnb%20e%20preciso%20de%20ajuda`;
      elBtnWhats.innerHTML = `<i class="fa-brands fa-whatsapp text-sm"></i> Falar com ${nomeHost}`;
    }

    // 4. Horários Check-in e Check-out
    const elCheckin = document.getElementById('horario-checkin');
    const elCheckout = document.getElementById('horario-checkout');
    if (elCheckin && dados.checkin_time) elCheckin.textContent = dados.checkin_time;
    if (elCheckout && dados.checkout_time) elCheckout.textContent = dados.checkout_time;

    // 5. Regras da Casa
    const elRegras = document.getElementById('lista-regras');
    if (elRegras && dados.house_rules) {
      elRegras.innerHTML = dados.house_rules
        .split('\n')
        .filter(r => r.trim().length > 0)
        .map(r => `
          <li class="flex items-start gap-2">
            <i class="fa-solid fa-circle-check text-rose-500 mt-1 text-xs"></i>
            <span>${r.trim()}</span>
          </li>
        `).join('');
    }

    // 6. Dicas da Região Padronizadas (Cards Sanfonados)
    const containerDicas = document.getElementById('container-dicas');
    const textoDicas = dados.dicas_regiao || 
                       dados['links e dicas da região (google maps)'] || 
                       dados['links e dicas da região (google maps) '] || '';

    if (containerDicas) {
      if (!textoDicas.trim()) {
        containerDicas.innerHTML = `<p class="text-xs text-slate-400">Consulte o anfitrião para recomendações locais.</p>`;
      } else {
        const linhasBrutas = textoDicas.split('\n').filter(l => l.trim().length > 0);
        const locaisFormatados = linhasBrutas.map(extrairDadosLocal).filter(Boolean);

        containerDicas.innerHTML = locaisFormatados.map(local => `
          <details class="group bg-slate-50 rounded-xl border border-slate-200/80 overflow-hidden transition-all duration-200">
            <summary class="flex items-center justify-between p-3 cursor-pointer list-none select-none hover:bg-slate-100/70 transition">
              <div class="flex items-center gap-2.5 min-w-0">
                <div class="w-8 h-8 rounded-lg bg-rose-50 text-airbnb flex items-center justify-center text-sm shrink-0">
                  <i class="fa-solid fa-location-dot"></i>
                </div>
                <p class="text-sm font-semibold text-slate-800 truncate">${local.nome}</p>
              </div>
              <div class="flex items-center gap-2 shrink-0 ml-2">
                ${local.distancia ? `
                  <span class="bg-rose-50 text-rose-700 border border-rose-200/60 font-semibold text-[10px] px-1.5 py-0.5 rounded-full">
                    ${local.distancia}
                  </span>
                ` : ''}
                <i class="fa-solid fa-chevron-down text-xs text-slate-400 group-open:rotate-180 transition-transform duration-200"></i>
              </div>
            </summary>
            <div class="px-3 pb-3 pt-1 border-t border-slate-100 space-y-2 text-xs text-slate-600 bg-white">
              ${local.url ? `
                <a href="${local.url}" target="_blank" class="inline-flex items-center gap-1.5 text-airbnb font-semibold hover:underline pt-1">
                  <span>Abrir no Google Maps</span>
                  <i class="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                </a>
              ` : `
                <p class="text-slate-400">Endereço sob consulta com o anfitrião.</p>
              `}
            </div>
          </details>
        `).join('');
      }
    }

  } catch (err) {
    console.error("Erro ao carregar dados da planilha:", err);
  }
}

/**
 * Exibe tela de aviso amigável quando o guia não existe ou não foi aprovado
 */
function mostrarMensagem(titulo, subtexto) {
  document.body.innerHTML = `
    <div class="min-h-screen flex items-center justify-center p-6 bg-slate-50 font-sans">
      <div class="max-w-md w-full bg-white p-6 rounded-2xl border border-slate-200 text-center shadow-sm">
        <div class="w-12 h-12 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-3">
          <i class="fa-solid fa-circle-exclamation text-xl"></i>
        </div>
        <h2 class="text-base font-bold text-slate-900 mb-1">${titulo}</h2>
        <p class="text-xs text-slate-500 leading-relaxed">${subtexto}</p>
      </div>
    </div>
  `;
}

// Inicializa a renderização quando o documento HTML estiver pronto
window.addEventListener('DOMContentLoaded', carregarDadosAcomodacao);
