const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRVpZ_M7Dt_kTC-gSUoL7saEfC3RFe-VfiKV4mPHlBntir_NUh9NU2xUbqcPJUnEreDxjGHjiHU4d7E/pub?gid=2120332944&single=true&output=csv";

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

    const cabecalho = matriz[0].map(col => col.toLowerCase().trim());
    const idIdx = cabecalho.indexOf('id');

    const linha = matriz.slice(1).find(row => {
      const celulaId = (row[idIdx] || '').trim();
      return celulaId === idProcurado.trim() || celulaId.startsWith(idProcurado.trim());
    });

    if (!linha) {
      mostrarMensagem("Acomodação não encontrada", "Não encontramos nenhum manual com este identificador.");
      return;
    }

    const dados = {};
    cabecalho.forEach((col, idx) => {
      dados[col] = linha[idx] || '';
    });

    if (dados.status !== 'PUBLICADO') {
      mostrarMensagem("Guia em Preparação", "O manual desta acomodação ainda está sendo aprovado e configurado pelo anfitrião.");
      return;
    }

    // Preenchimento dos dados na página
    document.title = `${dados.accommodation_name || 'Manual'} | Guia do Hóspede`;

    const elNomeAcomodacao = document.getElementById('nome-acomodacao');
    if (elNomeAcomodacao && dados.accommodation_name) elNomeAcomodacao.textContent = dados.accommodation_name;

    const elWifiSsid = document.getElementById('wifi-ssid');
    const elWifiPass = document.getElementById('wifi-pass');
    if (elWifiSsid && dados.wifi_ssid) elWifiSsid.textContent = dados.wifi_ssid;
    if (elWifiPass && dados.wifi_pass) elWifiPass.textContent = dados.wifi_pass;

    const elBtnWhats = document.getElementById('btn-whatsapp');
    if (elBtnWhats && dados.host_whatsapp) {
      const telDigitos = dados.host_whatsapp.replace(/\D/g, '');
      const ddiTel = telDigitos.startsWith('55') ? telDigitos : `55${telDigitos}`;
      const nomeHost = dados.host_name || 'Anfitrião';
      elBtnWhats.href = `https://wa.me/${ddiTel}?text=Ol%C3%A1%2C%20${encodeURIComponent(nomeHost)}!%20Sou%20h%C3%B3spede%20do%20Airbnb%20e%20preciso%20de%20ajuda`;
      elBtnWhats.innerHTML = `<i class="fa-brands fa-whatsapp text-sm"></i> Falar com ${nomeHost}`;
    }

    const elCheckin = document.getElementById('horario-checkin');
    const elCheckout = document.getElementById('horario-checkout');
    if (elCheckin && dados.checkin_time) elCheckin.textContent = dados.checkin_time;
    if (elCheckout && dados.checkout_time) elCheckout.textContent = dados.checkout_time;

    // Renderizar Dicas da Região dinâmicas (Google Maps)
    const containerDicas = document.getElementById('container-dicas');
    const textoDicas = dados.dicas_regiao || dados['links e dicas da região (google maps)'] || '';

    if (containerDicas) {
      if (!textoDicas.trim()) {
        containerDicas.innerHTML = `<p class="text-xs text-slate-400">Consulte o anfitrião para recomendações locais.</p>`;
      } else {
        const itens = textoDicas.split('\n').filter(i => i.trim().length > 0);
        
        containerDicas.innerHTML = itens.map(item => {
          // Extrai o link do Google Maps da linha
          const matchUrl = item.match(/(https?:\/\/[^\s]+)/gi);
          const linkUrl = matchUrl ? matchUrl[0] : null;
          
          // Remove a URL para obter o texto descritivo
          let texto = item.replace(linkUrl || '', '').replace(/^[•\-\*]\s*/, '').trim();
          if (!texto && linkUrl) texto = "Local Recomendado";

          return `
            <details class="group bg-slate-50 rounded-xl border border-slate-200/80 overflow-hidden transition-all duration-200">
              <summary class="flex items-center justify-between p-3 cursor-pointer list-none select-none hover:bg-slate-100/70 transition">
                <div class="flex items-center gap-2.5 min-w-0">
                  <div class="w-8 h-8 rounded-lg bg-rose-50 text-airbnb flex items-center justify-center text-sm shrink-0">
                    <i class="fa-solid fa-location-dot"></i>
                  </div>
                  <p class="text-sm font-semibold text-slate-800 truncate">${texto}</p>
                </div>
                <i class="fa-solid fa-chevron-down text-xs text-slate-400 group-open:rotate-180 transition-transform duration-200"></i>
              </summary>
              <div class="px-3 pb-3 pt-1 border-t border-slate-100 space-y-2 text-xs text-slate-600 bg-white">
                ${linkUrl ? `
                  <a href="${linkUrl}" target="_blank" class="inline-flex items-center gap-1.5 text-airbnb font-semibold hover:underline pt-1">
                    <span>Abrir no Google Maps</span>
                    <i class="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                  </a>
                ` : `<p class="text-slate-400">Endereço sob consulta com o anfitrião.</p>`}
              </div>
            </details>
          `;
        }).join('');
      }
    }

  } catch (err) {
    console.error("Erro ao carregar dados da planilha:", err);
  }
}

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

window.addEventListener('DOMContentLoaded', carregarDadosAcomodacao);
