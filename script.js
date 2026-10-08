const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRVpZ_M7Dt_kTC-gSUoL7saEfC3RFe-VfiKV4mPHlBntir_NUh9NU2xUbqcPJUnEreDxjGHjiHU4d7E/pub?gid=2120332944&single=true&output=csv";

// Função para fazer o parse correto de CSV respeitando quebras de linha e vírgulas entre aspas
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
    const statusIdx = cabecalho.indexOf('status');

    // Localiza a linha correspondente
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

    // Se não estiver publicado
    if (dados.status !== 'PUBLICADO') {
      mostrarMensagem("Guia em Preparação", "O manual desta acomodação ainda está sendo aprovado e configurado pelo anfitrião.");
      return;
    }

    // Preenche as informações na tela
    document.title = `${dados.accommodation_name || 'Manual'} | Guia do Hóspede`;

    // Título da Acomodação
    const elNomeAcomodacao = document.getElementById('nome-acomodacao');
    if (elNomeAcomodacao && dados.accommodation_name) elNomeAcomodacao.textContent = dados.accommodation_name;

    // Wi-Fi
    const elWifiSsid = document.getElementById('wifi-ssid');
    const elWifiPass = document.getElementById('wifi-pass');
    if (elWifiSsid && dados.wifi_ssid) elWifiSsid.textContent = dados.wifi_ssid;
    if (elWifiPass && dados.wifi_pass) elWifiPass.textContent = dados.wifi_pass;

    // Botão WhatsApp Host
    const elBtnWhats = document.getElementById('btn-whatsapp');
    if (elBtnWhats && dados.host_whatsapp) {
      const telDigitos = dados.host_whatsapp.replace(/\D/g, '');
      const ddiTel = telDigitos.startsWith('55') ? telDigitos : `55${telDigitos}`;
      const nomeHost = dados.host_name || 'Anfitrião';
      elBtnWhats.href = `https://wa.me/${ddiTel}?text=Ol%C3%A1%2C%20${encodeURIComponent(nomeHost)}!%20Sou%20h%C3%B3spede%20do%20Airbnb%20e%20preciso%20de%20ajuda`;
      elBtnWhats.innerHTML = `<i class="fa-brands fa-whatsapp text-sm"></i> Falar com ${nomeHost}`;
    }

    // Horários Check-in / Check-out
    const elCheckin = document.getElementById('horario-checkin');
    const elCheckout = document.getElementById('horario-checkout');
    if (elCheckin && dados.checkin_time) elCheckin.textContent = dados.checkin_time;
    if (elCheckout && dados.checkout_time) elCheckout.textContent = dados.checkout_time;

    // Regras da Casa
    const elRegras = document.getElementById('lista-regras');
    if (elRegras && dados.house_rules) {
      elRegras.innerHTML = dados.house_rules
        .split('\n')
        .filter(r => r.trim().length > 0)
        .map(r => `<li class="flex items-start gap-2"><i class="fa-solid fa-circle-check text-rose-500 mt-1 text-xs"></i><span>${r}</span></li>`)
        .join('');
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
