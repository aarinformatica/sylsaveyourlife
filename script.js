
"use strict";

/* =========================================================
   SYL — SAFE YOUR LIFE
   JavaScript principal
   Integrado ao index.html e style.css atuais
========================================================= */


/* =========================================================
   CONFIGURAÇÃO
========================================================= */

const SYL_CONFIG = {
  /*
   * IMPORTANTE:
   * Não coloque uma chave secreta de produção no navegador.
   *
   * Para testes locais, uma chave nova pode ser configurada
   * temporariamente aqui. Para produção, prefira authUrl.
   */

  ABLY_KEY: "zfqwdA.QY0KxQ:_RQcTI6NCeRMNnLLyC8Ebb6Lg50xnDlcwvRv4wQ3H5o",

  // Endpoint opcional para autenticação segura por token.
  // Exemplo: "/api/ably-token"
  ABLY_AUTH_URL: "",

  CHANNEL_NAME: "syl-mobilidade-urbana-v1",

  DEFAULT_ZOOM: 15,

  ALERT_DISTANCE: 500,

  POSITION_INTERVAL: 10000,

  ALERT_COOLDOWN: 60000,

  MAP_DEFAULT_LAT: -15.7939,
  MAP_DEFAULT_LNG: -47.8828
};


/* =========================================================
   ELEMENTOS DO HTML
========================================================= */

const els = {
  loginScreen: document.getElementById("loginScreen"),
  appScreen: document.getElementById("appScreen"),

  entryForm: document.getElementById("entryForm"),
  userNameInput: document.getElementById("userNameInput"),

  vehicleFields: document.getElementById("vehicleFields"),
  vehicleModel: document.getElementById("vehicleModel"),
  electricVehicle: document.getElementById("electricVehicle"),

  userDisplay: document.getElementById("userDisplay"),
  moduleDescription: document.getElementById("moduleDescription"),
  moduleBadge: document.getElementById("moduleBadge"),

  pedestrianModule: document.getElementById("pedestrianModule"),
  driverModule: document.getElementById("driverModule"),

  driverVehicleDescription:
    document.getElementById("driverVehicleDescription"),

  driverVehicleName:
    document.getElementById("driverVehicleName"),

  vehicleCard: document.getElementById("vehicleCard"),
  electricStatus: document.getElementById("electricStatus"),

  connectionStatus: document.getElementById("connectionStatus"),

  gpsStatus: document.getElementById("gpsStatus"),
  gpsAccuracy: document.getElementById("gpsAccuracy"),
  gpsIndicator: document.getElementById("gpsIndicator"),

  nearbyCount: document.getElementById("nearbyCount"),
  nearbySummaryCount: document.getElementById("nearbySummaryCount"),
  mobileNearbyBadge: document.getElementById("mobileNearbyBadge"),

  protectionStatus: document.getElementById("protectionStatus"),

  nearbyUsers: document.getElementById("nearbyUsers"),

  mapStatusText: document.getElementById("mapStatusText"),
  lastUpdate: document.getElementById("lastUpdate"),

  locateButton: document.getElementById("locateButton"),
  settingsButton: document.getElementById("settingsButton"),
  exitButton: document.getElementById("exitButton"),

  settingsModal: document.getElementById("settingsModal"),
  exitModal: document.getElementById("exitModal"),

  themeSelect: document.getElementById("themeSelect"),

  markerColor: document.getElementById("markerColor"),
  markerColorPreview:
    document.getElementById("markerColorPreview"),

  markerColorHex: document.getElementById("markerColorHex"),

  alertDistance: document.getElementById("alertDistance"),
  soundAlerts: document.getElementById("soundAlerts"),
  vibrationAlerts: document.getElementById("vibrationAlerts"),

  saveSettings: document.getElementById("saveSettings"),

  cancelExit: document.getElementById("cancelExit"),
  confirmExit: document.getElementById("confirmExit"),

  toast: document.getElementById("toast"),
  clock: document.getElementById("clock")
};


/* =========================================================
   ESTADO GLOBAL
========================================================= */

const state = {
  profile: null,

  map: null,
  ownMarker: null,
  ownPosition: null,
  mapCentered: false,

  remoteMarkers: new Map(),
  remoteUsers: new Map(),

  ably: null,
  channel: null,
  clientId: null,

  connected: false,
  presenceEntered: false,
  presenceSubscribed: false,
  connecting: false,

  watchId: null,

  positionTimer: null,
  clockTimer: null,
  toastTimer: null,

  markerColor: "#1689ed",

  alertDistance: SYL_CONFIG.ALERT_DISTANCE,

  soundAlerts: true,
  vibrationAlerts: true,

  lastAlertByUser: new Map(),

  exiting: false,

  mobileTab: "home",
  previousMobileTab: "home"
};


/* =========================================================
   INICIALIZAÇÃO
========================================================= */

document.addEventListener("DOMContentLoaded", initialize);

function initialize() {
  loadSettings();

  bindEvents();

  updateVehicleFields();

  updateClock();

  state.clockTimer = setInterval(updateClock, 1000);

  console.log("SYL iniciado com sucesso.");
}


/* =========================================================
   VALIDAÇÃO DOS ELEMENTOS
========================================================= */

function elementExists(element) {
  return element instanceof HTMLElement;
}


/* =========================================================
   EVENTOS
========================================================= */

function bindEvents() {

  // Seleção do módulo.
  document.querySelectorAll('input[name="userMode"]').forEach(input => {
    input.addEventListener("change", updateVehicleFields);
  });


  // Entrada.
  els.entryForm?.addEventListener("submit", handleEntry);


  // Botões principais.
  els.locateButton?.addEventListener("click", centerOnUser);

  els.settingsButton?.addEventListener("click", openSettings);

  els.exitButton?.addEventListener("click", openExitModal);


  // Configurações.
  els.saveSettings?.addEventListener("click", saveSettings);


  // Saída.
  els.cancelExit?.addEventListener("click", closeExitModal);

  els.confirmExit?.addEventListener("click", exitApplication);


  // Cor personalizada.
  els.markerColor?.addEventListener("input", event => {
    updateMarkerColorPreview(event.target.value);
  });


  // Cores predefinidas.
  document.querySelectorAll(".color-preset").forEach(button => {

    button.addEventListener("click", () => {

      const color = button.dataset.color;

      if (!isValidColor(color)) return;

      els.markerColor.value = color;

      updateMarkerColorPreview(color);

      updateSelectedPreset(color);

    });

  });


  // Botões de fechamento dos modais.
  document.querySelectorAll("[data-close]").forEach(button => {

    button.addEventListener("click", () => {

      closeModal(button.dataset.close);

    });

  });


  // Fechar modal clicando no fundo.
  [els.settingsModal, els.exitModal].forEach(modal => {

    if (!modal) return;

    modal.addEventListener("click", event => {

      if (event.target === modal) {

        const modalId = modal.id;

        closeModal(modalId);

      }

    });

  });


  // Tema.
  els.themeSelect?.addEventListener("change", () => {

    applyTheme(els.themeSelect.value);

  });


  // Navegação inferior para celular.
  document.querySelectorAll("[data-mobile-tab]").forEach(button => {

    button.addEventListener("click", () => {

      setMobileTab(button.dataset.mobileTab);

    });

  });

}


/* =========================================================
   SELEÇÃO DO MÓDULO
========================================================= */

function updateVehicleFields() {

  const selectedMode = document.querySelector(
    'input[name="userMode"]:checked'
  )?.value;

  const isDriver = selectedMode === "motorista";

  if (!els.vehicleFields) return;

  els.vehicleFields.classList.toggle("visible", isDriver);

  els.vehicleFields.classList.toggle("active", isDriver);

  if (els.vehicleModel) {
    els.vehicleModel.disabled = !isDriver;
  }

  if (els.electricVehicle) {
    els.electricVehicle.disabled = !isDriver;
  }

  if (!isDriver) {

    if (els.vehicleModel) {
      els.vehicleModel.value = "";
    }

    if (els.electricVehicle) {
      els.electricVehicle.checked = false;
    }

  }

}


/* =========================================================
   ENTRADA NO APLICATIVO
========================================================= */

function handleEntry(event) {

  event.preventDefault();

  if (state.profile) return;

  const name = els.userNameInput.value.trim();

  if (name.length < 2) {

    showToast("Digite um nome com pelo menos 2 caracteres.");

    els.userNameInput.focus();

    return;
  }

  const mode = document.querySelector(
    'input[name="userMode"]:checked'
  )?.value || "pedestre";


  const savedColor = getSavedMarkerColor();

  const defaultColor = mode === "motorista"
    ? "#ff8a24"
    : "#1689ed";


  const profile = {

    name,

    mode,

    vehicleModel: mode === "motorista"
      ? els.vehicleModel.value.trim()
      : "",

    electricVehicle: mode === "motorista"
      ? els.electricVehicle.checked
      : false,

    markerColor: savedColor || defaultColor

  };


  state.profile = profile;

  state.markerColor = profile.markerColor;

  state.mobileTab = "home";
  state.previousMobileTab = "home";

  updateMarkerColorPreview(state.markerColor);


  els.loginScreen.classList.add("hidden");

  els.appScreen.classList.remove("hidden");

  els.appScreen.dataset.mobileTab = "home";


  restoreMobileTab();

  renderModule(profile);

  initializeMap();

  startGeolocation();

  connectAbly();


  showToast(`Bem-vindo ao SYL, ${profile.name}!`);

}


/* =========================================================
   MÓDULO ATIVO
========================================================= */

function renderModule(profile) {

  const isDriver = profile.mode === "motorista";

  els.userDisplay.textContent = profile.name;

  els.pedestrianModule.classList.toggle("hidden", isDriver);

  els.driverModule.classList.toggle("hidden", !isDriver);


  els.moduleBadge.classList.toggle(
    "pedestrian-badge",
    !isDriver
  );

  els.moduleBadge.classList.toggle(
    "driver-badge",
    isDriver
  );


  if (isDriver) {

    els.moduleBadge.innerHTML = `
      <span class="badge-icon">
        <i class="fa-solid fa-car-side"></i>
      </span>

      <span>
        <small>MÓDULO ATIVO</small>
        <strong>Motorista</strong>
      </span>

      <span class="badge-live"></span>
    `;


    els.moduleDescription.textContent =
      "Sua central de mobilidade e segurança no trânsito.";


    els.driverVehicleName.textContent =
      profile.vehicleModel || "Veículo não informado";


    els.driverVehicleDescription.textContent =
      profile.vehicleModel
        ? `Veículo cadastrado: ${profile.vehicleModel}. Acompanhe sua posição e a rede SYL.`
        : "Acompanhe sua posição e os usuários próximos durante seus trajetos.";


    els.vehicleCard.classList.remove("hidden");


    if (profile.electricVehicle) {

      els.electricStatus.classList.add("electric");

      els.electricStatus.innerHTML = `
        <i class="fa-solid fa-bolt"></i>
        <span>Veículo elétrico ou híbrido</span>
      `;

    } else {

      els.electricStatus.classList.remove("electric");

      els.electricStatus.innerHTML = `
        <i class="fa-solid fa-gas-pump"></i>
        <span>Veículo convencional</span>
      `;

    }

  } else {

    els.moduleBadge.innerHTML = `
      <span class="badge-icon">
        <i class="fa-solid fa-person-walking"></i>
      </span>

      <span>
        <small>MÓDULO ATIVO</small>
        <strong>Pedestre</strong>
      </span>

      <span class="badge-live"></span>
    `;


    els.moduleDescription.textContent =
      "Sua rede de proteção está pronta para acompanhar você.";


    els.vehicleCard.classList.add("hidden");

  }

}


/* =========================================================
   MAPA LEAFLET
========================================================= */

function initializeMap() {

  if (!window.L) {

    showToast("Não foi possível carregar o mapa.");

    els.mapStatusText.textContent = "ERRO AO CARREGAR MAPA";

    return;
  }


  if (state.map) {

    state.map.remove();

    state.map = null;

  }


  state.ownMarker = null;

  state.remoteMarkers.clear();


  state.map = L.map("map", {

    zoomControl: true,

    scrollWheelZoom: true

  }).setView(

    [
      SYL_CONFIG.MAP_DEFAULT_LAT,
      SYL_CONFIG.MAP_DEFAULT_LNG
    ],

    SYL_CONFIG.DEFAULT_ZOOM

  );


  L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {

      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',

      maxZoom: 19

    }
  ).addTo(state.map);


  setTimeout(() => {

    state.map?.invalidateSize(true);

  }, 300);

}


/* =========================================================
   CORES DOS MARCADORES
========================================================= */

function isValidColor(color) {

  return typeof color === "string" &&
    /^#[0-9a-fA-F]{6}$/.test(color);

}


function getUserMarkerColor(user) {

  if (isValidColor(user.markerColor)) {

    return user.markerColor;

  }


  if (user.mode === "motorista") {

    return user.electricVehicle
      ? "#00aeca"
      : "#ff8a24";

  }


  return "#1689ed";

}


/* =========================================================
   ÍCONES DOS MARCADORES
========================================================= */

function createUserIcon(user, isSelf = false) {

  const markerColor = getUserMarkerColor(user);

  let mainIcon = "fa-person-walking";

  let electricBadge = "";


  if (user.mode === "motorista") {

    mainIcon = "fa-car-side";

    if (user.electricVehicle) {

      electricBadge = `
        <span class="marker-bolt">
          <i class="fa-solid fa-bolt"></i>
        </span>
      `;

    }

  }


  const html = `

    <div
      class="syl-marker-container ${isSelf ? "is-self" : ""}"
      style="--marker-color:${markerColor}"
    >

      <span class="syl-marker-ring"></span>

      <span class="syl-marker-ring ring-two"></span>

      <span class="syl-marker-core">

        <i class="fa-solid ${mainIcon}"></i>

        ${electricBadge}

      </span>

      <span class="syl-marker-tail"></span>

    </div>

  `;


  return L.divIcon({

    className: "syl-div-icon",

    html,

    iconSize: [62, 70],

    iconAnchor: [31, 48],

    popupAnchor: [0, -45]

  });

}


/* =========================================================
   MARCADOR DO PRÓPRIO USUÁRIO
========================================================= */

function updateOwnMarker() {

  if (
    !state.map ||
    !state.ownPosition ||
    !state.profile
  ) {

    return;

  }


  const position = [

    state.ownPosition.latitude,

    state.ownPosition.longitude

  ];


  const icon = createUserIcon(state.profile, true);


  if (!state.ownMarker) {

    state.ownMarker = L.marker(position, {

      icon,

      zIndexOffset: 1000

    }).addTo(state.map);


    state.ownMarker.bindPopup(

      createPopupContent(state.profile, true)

    );


  } else {

    state.ownMarker.setLatLng(position);

    state.ownMarker.setIcon(icon);

    state.ownMarker.setPopupContent(

      createPopupContent(state.profile, true)

    );

  }

}


/* =========================================================
   GEOLOCALIZAÇÃO
========================================================= */

function startGeolocation() {

  if (!navigator.geolocation) {

    els.gpsStatus.textContent = "Não disponível";

    els.gpsAccuracy.textContent =
      "Navegador sem suporte ao GPS";

    showToast("Seu navegador não oferece suporte à localização.");

    return;
  }


  // Evita iniciar dois monitoramentos.
  stopGeolocation();


  els.gpsStatus.textContent = "Localizando...";

  els.gpsAccuracy.textContent =
    "Aguardando sinal do dispositivo";


  /*
   * CORREÇÃO:
   * O identificador retornado por watchPosition é armazenado.
   * Assim, stopGeolocation consegue encerrar o GPS corretamente.
   */

  state.watchId = navigator.geolocation.watchPosition(

    position => {

      const coords = position.coords;


      state.ownPosition = {

        latitude: coords.latitude,

        longitude: coords.longitude,

        accuracy: coords.accuracy,

        timestamp: Date.now()

      };


      els.gpsStatus.textContent = "Localização ativa";

      els.gpsAccuracy.textContent =
        `Precisão aproximada: ${Math.round(coords.accuracy)} m`;


      els.gpsIndicator.classList.add("active");


      els.lastUpdate.textContent =
        `Atualizado às ${new Date().toLocaleTimeString("pt-BR")}`;


      updateOwnMarker();

      updateNearbyUsers();

      checkProximityAlerts();

      publishPosition();


      if (state.map && !state.mapCentered) {

        state.map.setView(

          [
            coords.latitude,
            coords.longitude
          ],

          SYL_CONFIG.DEFAULT_ZOOM

        );

        state.mapCentered = true;

      }


      // Caso a pessoa esteja na aba do mapa,
      // atualiza o tamanho do Leaflet.
      if (state.mobileTab === "map") {

        state.map?.invalidateSize(true);

      }

    },


    error => {

      console.error("Erro de GPS:", error);


      const messages = {

        1: "Permissão negada",

        2: "Posição indisponível",

        3: "Tempo esgotado"

      };


      els.gpsStatus.textContent =
        messages[error.code] || "Erro no GPS";


      els.gpsAccuracy.textContent =
        "Verifique as permissões de localização.";


      els.gpsIndicator.classList.remove("active");


      if (error.code === 1) {

        showToast(
          "Permita o acesso à localização nas configurações do navegador."
        );

      }

    },


    {

      enableHighAccuracy: true,

      maximumAge: 5000,

      timeout: 20000

    }

  );

}


/* =========================================================
   CENTRALIZAR MAPA
========================================================= */

function centerOnUser() {

  if (!state.map) return;


  if (!state.ownPosition) {

    showToast("Aguardando sua localização GPS.");

    return;

  }


  state.map.flyTo(

    [
      state.ownPosition.latitude,
      state.ownPosition.longitude
    ],

    17,

    { duration: 1.2 }

  );


  state.ownMarker?.openPopup();

}


/* =========================================================
   ABLY — CONEXÃO
========================================================= */

function connectAbly() {

  if (state.connecting || state.ably) return;


  if (!window.Ably) {

    setConnectionStatus(
      "Biblioteca Ably não carregada",
      false
    );

    showToast("Não foi possível carregar a biblioteca Ably.");

    return;

  }


  if (!SYL_CONFIG.ABLY_AUTH_URL && !SYL_CONFIG.ABLY_KEY) {

    setConnectionStatus("Ably não configurado", false);

    els.mapStatusText.textContent = "AGUARDANDO ABLY";

    showToast(
      "Configure a autenticação Ably para conectar os usuários."
    );

    return;

  }


  try {

    state.connecting = true;

    state.clientId = createClientId();


    const ablyOptions = {

      clientId: state.clientId,

      autoConnect: true

    };


    if (SYL_CONFIG.ABLY_AUTH_URL) {

      ablyOptions.authUrl = SYL_CONFIG.ABLY_AUTH_URL;

      ablyOptions.authMethod = "GET";

    } else {

      /*
       * Somente para testes.
       * Não publique uma chave secreta no frontend.
       */

      ablyOptions.key = SYL_CONFIG.ABLY_KEY;

    }


    state.ably = new Ably.Realtime(ablyOptions);


    state.ably.connection.on("connected", () => {

      state.connecting = false;

      state.connected = true;

      setConnectionStatus(
        "Conectado em tempo real",
        true
      );

      els.mapStatusText.textContent =
        "REDE SYL CONECTADA";


      /*
       * Executado também após reconexões.
       */

      subscribePresence();

    });


    state.ably.connection.on("connecting", () => {

      setConnectionStatus("Conectando...", false);

    });


    state.ably.connection.on("disconnected", () => {

      state.connected = false;

      state.presenceEntered = false;

      setConnectionStatus("Reconectando...", false);

      els.mapStatusText.textContent = "RECONEXÃO";

    });


    state.ably.connection.on("suspended", () => {

      state.connected = false;

      state.presenceEntered = false;

      setConnectionStatus("Conexão suspensa", false);

    });


    state.ably.connection.on("failed", error => {

      state.connected = false;

      state.presenceEntered = false;

      state.connecting = false;

      setConnectionStatus("Falha na conexão", false);

      console.error("Falha Ably:", error);

    });


  } catch (error) {

    state.connecting = false;

    console.error("Erro ao iniciar Ably:", error);

    setConnectionStatus("Erro de conexão", false);

    showToast("Não foi possível iniciar a conexão em tempo real.");

  }

}


/* =========================================================
   IDENTIFICADOR DO CLIENTE
========================================================= */

function createClientId() {

  if (
    window.crypto &&
    typeof window.crypto.randomUUID === "function"
  ) {

    return window.crypto.randomUUID();

  }


  return "syl-" +
    Date.now() +
    "-" +
    Math.random().toString(36).slice(2, 10);

}


/* =========================================================
   PRESENÇA ABLY
========================================================= */

function subscribePresence() {

  if (!state.ably || !state.connected) return;


  // Cria o canal apenas uma vez.
  if (!state.channel) {

    state.channel = state.ably.channels.get(
      SYL_CONFIG.CHANNEL_NAME
    );

  }


  // Inscreve os eventos de presença apenas uma vez.
  if (!state.presenceSubscribed) {

    state.channel.presence.subscribe(
      ["enter", "update", "leave"],
      () => {

        refreshPresence();

      }
    );


    state.presenceSubscribed = true;

  }


  /*
   * Em uma reconexão, o canal já existe.
   * Precisamos registrar novamente a presença.
   */

  if (state.presenceEntered) {

    refreshPresence();

    return;

  }


  state.channel.presence.enter(makePresenceData())

    .then(() => {

      state.presenceEntered = true;

      refreshPresence();

      startPositionPublishing();

      // Envia imediatamente a posição caso o GPS já esteja ativo.
      publishPosition();

    })

    .catch(error => {

      console.error("Erro ao entrar na presença:", error);


      /*
       * Em determinadas reconexões, a presença pode ainda estar
       * registrada. Tenta atualizar antes de desistir.
       */

      state.channel.presence.update(makePresenceData())

        .then(() => {

          state.presenceEntered = true;

          refreshPresence();

          startPositionPublishing();

        })

        .catch(updateError => {

          console.error(
            "Erro ao recuperar presença:",
            updateError
          );

          showToast(
            "Não foi possível registrar sua presença no SYL."
          );

        });

    });

}


/* =========================================================
   DADOS DA PRESENÇA
========================================================= */

function makePresenceData() {

  const profile = state.profile || {};


  return {

    name: profile.name || "Usuário",

    mode: profile.mode || "pedestre",

    vehicleModel: profile.vehicleModel || "",

    electricVehicle: Boolean(profile.electricVehicle),

    markerColor: getUserMarkerColor({

      ...profile,

      markerColor: state.markerColor

    }),

    latitude: state.ownPosition?.latitude ?? null,

    longitude: state.ownPosition?.longitude ?? null,

    accuracy: state.ownPosition?.accuracy ?? null,

    updatedAt: Date.now()

  };

}


/* =========================================================
   PUBLICAÇÃO DA LOCALIZAÇÃO
========================================================= */

function startPositionPublishing() {

  if (state.positionTimer) {

    clearInterval(state.positionTimer);

  }


  state.positionTimer = setInterval(() => {

    publishPosition();

  }, SYL_CONFIG.POSITION_INTERVAL);

}


function publishPosition() {

  if (
    !state.channel ||
    !state.connected ||
    !state.presenceEntered ||
    !state.ownPosition
  ) {

    return;

  }


  state.channel.presence.update(makePresenceData())

    .catch(error => {

      console.error(
        "Erro ao atualizar presença:",
        error
      );

    });

}


/* =========================================================
   CONSULTAR USUÁRIOS CONECTADOS
========================================================= */

async function refreshPresence() {

  if (!state.channel || !state.connected) return;


  try {

    const members = await state.channel.presence.get();

    const activeUsers = new Map();


    members.forEach(member => {

      const clientId = member.clientId;


      // Não exibe o próprio usuário na lista de outras pessoas.
      if (!clientId || clientId === state.clientId) {

        return;

      }


      const data = member.data || {};


      if (
        typeof data.latitude !== "number" ||
        typeof data.longitude !== "number"
      ) {

        return;

      }


      const user = {

        id: clientId,

        name: data.name || "Usuário SYL",

        mode: data.mode === "motorista"
          ? "motorista"
          : "pedestre",

        vehicleModel: data.vehicleModel || "",

        electricVehicle: Boolean(data.electricVehicle),

        markerColor: isValidColor(data.markerColor)
          ? data.markerColor
          : null,

        latitude: data.latitude,

        longitude: data.longitude,

        accuracy: data.accuracy ?? null,

        updatedAt: data.updatedAt || Date.now()

      };


      /*
       * Se houver mais de uma entrada para o mesmo clientId,
       * mantém a informação mais recente.
       */

      const existing = activeUsers.get(clientId);

      if (
        !existing ||
        user.updatedAt >= existing.updatedAt
      ) {

        activeUsers.set(clientId, user);

      }

    });


    state.remoteUsers = activeUsers;


    updateRemoteMarkers();

    updateNearbyUsers();

    checkProximityAlerts();


  } catch (error) {

    console.error(
      "Erro ao consultar presença:",
      error
    );

  }

}


/* =========================================================
   MARCADORES REMOTOS
========================================================= */

function updateRemoteMarkers() {

  if (!state.map) return;


  const activeIds = new Set(state.remoteUsers.keys());


  // Remove marcadores de usuários que saíram.
  for (const [id, marker] of state.remoteMarkers.entries()) {

    if (!activeIds.has(id)) {

      state.map.removeLayer(marker);

      state.remoteMarkers.delete(id);

    }

  }


  // Cria ou atualiza marcadores.
  state.remoteUsers.forEach(user => {

    const position = [

      user.latitude,

      user.longitude

    ];


    const icon = createUserIcon(user);


    if (state.remoteMarkers.has(user.id)) {

      const marker = state.remoteMarkers.get(user.id);

      marker.setLatLng(position);

      marker.setIcon(icon);

      marker.setPopupContent(
        createPopupContent(user)
      );


    } else {

      const marker = L.marker(position, {

        icon

      }).addTo(state.map);


      marker.bindPopup(
        createPopupContent(user)
      );


      state.remoteMarkers.set(user.id, marker);

    }

  });

}


/* =========================================================
   POPUP DOS MARCADORES
========================================================= */

function createPopupContent(user, isSelf = false) {

  const modeLabel = getModeLabel(user);


  const vehicle =
    user.mode === "motorista" && user.vehicleModel
      ? `<br><small>${escapeHTML(user.vehicleModel)}</small>`
      : "";


  const electric =
    user.mode === "motorista" && user.electricVehicle
      ? "<br><small>⚡ Veículo elétrico/híbrido</small>"
      : "";


  const self = isSelf
    ? "<br><small>Este é seu marcador</small>"
    : "";


  return `

    <div class="syl-popup">

      <strong>${escapeHTML(user.name)}</strong>

      <br>

      <span>${escapeHTML(modeLabel)}</span>

      ${vehicle}

      ${electric}

      ${self}

    </div>

  `;

}


/* =========================================================
   CÁLCULO DE DISTÂNCIA
========================================================= */

function calculateDistance(lat1, lon1, lat2, lon2) {

  const earthRadius = 6371000;

  const toRad = value => value * Math.PI / 180;


  const dLat = toRad(lat2 - lat1);

  const dLon = toRad(lon2 - lon1);


  const a =

    Math.sin(dLat / 2) ** 2 +

    Math.cos(toRad(lat1)) *

    Math.cos(toRad(lat2)) *

    Math.sin(dLon / 2) ** 2;


  const c = 2 * Math.atan2(

    Math.sqrt(a),

    Math.sqrt(1 - a)

  );


  return earthRadius * c;

}


function formatDistance(distance) {

  if (distance < 1000) {

    return `${Math.round(distance)} m`;

  }


  return `${(distance / 1000).toFixed(1).replace(".", ",")} km`;

}


/* =========================================================
   USUÁRIOS PRÓXIMOS
========================================================= */

function updateNearbyUsers() {

  if (!state.ownPosition) {

    els.nearbyCount.textContent = "0";

    els.nearbySummaryCount.textContent = "0";

    updateMobileNearbyBadge(0);

    renderEmptyNearbyUsers();

    return;

  }


  const nearby = [];


  state.remoteUsers.forEach(user => {

    const distance = calculateDistance(

      state.ownPosition.latitude,

      state.ownPosition.longitude,

      user.latitude,

      user.longitude

    );


    if (distance <= state.alertDistance) {

      nearby.push({

        ...user,

        distance

      });

    }

  });


  nearby.sort((a, b) => a.distance - b.distance);


  const count = nearby.length;


  els.nearbyCount.textContent = String(count);

  els.nearbySummaryCount.textContent = String(count);


  updateMobileNearbyBadge(count);


  if (!count) {

    renderEmptyNearbyUsers();

    return;

  }


  els.nearbyUsers.innerHTML = nearby.map(user => {

    const type = getMarkerType(user);

    const icon = getModeIcon(user);


    let description = "Pedestre";


    if (user.mode === "motorista") {

      description = user.electricVehicle
        ? "Motorista · Elétrico/híbrido"
        : "Motorista";

    }


    return `

      <article class="nearby-user">

        <div class="nearby-avatar ${type}">

          <i class="fa-solid ${icon}"></i>

        </div>


        <div class="nearby-user-info">

          <strong>${escapeHTML(user.name)}</strong>

          <small>${escapeHTML(description)}</small>

        </div>


        <span class="nearby-distance">

          ${formatDistance(user.distance)}

        </span>

      </article>

    `;

  }).join("");

}


/* =========================================================
   ESTADO VAZIO DA LISTA
========================================================= */

function renderEmptyNearbyUsers() {

  if (!els.nearbyUsers) return;


  els.nearbyUsers.innerHTML = `

    <div class="empty-users">

      <span class="empty-users-icon">

        <i class="fa-solid fa-satellite-dish"></i>

      </span>


      <strong>Ninguém por perto ainda</strong>


      <p>

        Quando outros usuários entrarem na rede,
        aparecerão aqui.

      </p>

    </div>

  `;

}


/* =========================================================
   IDENTIDADE DOS MARCADORES
========================================================= */

function getMarkerType(user) {

  if (user.mode === "motorista") {

    return user.electricVehicle
      ? "electric"
      : "driver";

  }

  return "pedestrian";

}


function getModeIcon(user) {

  if (user.mode === "motorista") {

    return "fa-car-side";

  }

  return "fa-person-walking";

}


function getModeLabel(user) {

  if (user.mode === "motorista") {

    return user.electricVehicle
      ? "Motorista — Elétrico/híbrido"
      : "Motorista";

  }

  return "Pedestre";

}


/* =========================================================
   ALERTAS DE PROXIMIDADE
========================================================= */

function checkProximityAlerts() {

  if (!state.ownPosition) return;


  state.remoteUsers.forEach(user => {

    const distance = calculateDistance(

      state.ownPosition.latitude,

      state.ownPosition.longitude,

      user.latitude,

      user.longitude

    );


    if (distance > state.alertDistance) return;


    const lastAlert =
      state.lastAlertByUser.get(user.id) || 0;


    // Evita alertas repetidos durante 60 segundos.
    if (
      Date.now() - lastAlert <
      SYL_CONFIG.ALERT_COOLDOWN
    ) {

      return;

    }


    state.lastAlertByUser.set(
      user.id,
      Date.now()
    );


    showToast(

      `${user.name} está próximo de você (${getModeLabel(user)}, ${formatDistance(distance)}).`

    );


    triggerAlert();

  });

}


/* =========================================================
   DISPARAR ALERTAS
========================================================= */

function triggerAlert() {

  if (state.soundAlerts) {

    playAlertSound();

  }


  if (
    state.vibrationAlerts &&
    navigator.vibrate
  ) {

    navigator.vibrate([150, 80, 150]);

  }

}


/* =========================================================
   SOM DO ALERTA
========================================================= */

function playAlertSound() {

  try {

    const AudioContextClass =
      window.AudioContext ||
      window.webkitAudioContext;


    if (!AudioContextClass) return;


    const context = new AudioContextClass();

    const oscillator = context.createOscillator();

    const gain = context.createGain();


    oscillator.type = "sine";


    oscillator.frequency.setValueAtTime(
      880,
      context.currentTime
    );


    oscillator.frequency.setValueAtTime(
      660,
      context.currentTime + 0.12
    );


    gain.gain.setValueAtTime(
      0.001,
      context.currentTime
    );


    gain.gain.exponentialRampToValueAtTime(
      0.12,
      context.currentTime + 0.02
    );


    gain.gain.exponentialRampToValueAtTime(
      0.001,
      context.currentTime + 0.3
    );


    oscillator.connect(gain);

    gain.connect(context.destination);


    oscillator.start();

    oscillator.stop(context.currentTime + 0.32);


    oscillator.onended = () => {

      context.close();

    };


  } catch (error) {

    console.warn(
      "Falha ao reproduzir alerta:",
      error
    );

  }

}


/* =========================================================
   COR PERSONALIZADA
========================================================= */

function updateMarkerColorPreview(color) {

  if (!isValidColor(color)) return;


  if (els.markerColorPreview) {

    els.markerColorPreview.style.background = color;

    els.markerColorPreview.style.boxShadow =
      `0 0 14px ${color}66`;

  }


  if (els.markerColorHex) {

    els.markerColorHex.textContent =
      color.toUpperCase();

  }


  updateSelectedPreset(color);

}


function updateSelectedPreset(color) {

  document.querySelectorAll(".color-preset").forEach(button => {

    button.classList.toggle(

      "selected",

      button.dataset.color?.toLowerCase() ===
      color.toLowerCase()

    );

  });

}


function getSavedMarkerColor() {

  try {

    const saved = localStorage.getItem(
      "syl-marker-color"
    );

    return isValidColor(saved) ? saved : null;

  } catch {

    return null;

  }

}


function applyMarkerColor(color) {

  if (!isValidColor(color)) return;


  state.markerColor = color;


  if (state.profile) {

    state.profile.markerColor = color;

  }


  updateMarkerColorPreview(color);

  updateOwnMarker();


  // Atualiza os demais usuários pelo Ably.
  publishPosition();

}


/* =========================================================
   CONFIGURAÇÕES
========================================================= */

function openSettings() {

  if (!els.settingsModal) return;


  if (els.markerColor) {

    els.markerColor.value = state.markerColor;

  }


  updateMarkerColorPreview(state.markerColor);


  els.settingsModal.classList.remove("hidden");

}


function saveSettings() {

  const selectedColor = els.markerColor.value;


  if (!isValidColor(selectedColor)) {

    showToast("Selecione uma cor válida.");

    return;

  }


  const selectedDistance = Number(
    els.alertDistance.value
  );


  if (
    !Number.isFinite(selectedDistance) ||
    selectedDistance <= 0
  ) {

    showToast("Selecione uma distância válida.");

    return;

  }


  state.alertDistance = selectedDistance;

  state.soundAlerts = els.soundAlerts.checked;

  state.vibrationAlerts = els.vibrationAlerts.checked;


  applyMarkerColor(selectedColor);


  const settings = {

    theme: els.themeSelect.value,

    markerColor: selectedColor,

    alertDistance: state.alertDistance,

    soundAlerts: state.soundAlerts,

    vibrationAlerts: state.vibrationAlerts

  };


  try {

    localStorage.setItem(
      "syl-settings",
      JSON.stringify(settings)
    );


    localStorage.setItem(
      "syl-marker-color",
      selectedColor
    );


  } catch (error) {

    console.warn(
      "Não foi possível salvar preferências:",
      error
    );

  }


  updateNearbyUsers();

  closeModal("settingsModal");

  showToast("Suas configurações foram atualizadas.");

}


/* =========================================================
   CARREGAR CONFIGURAÇÕES
========================================================= */

function loadSettings() {

  try {

    const saved = JSON.parse(

      localStorage.getItem("syl-settings") || "{}"

    );


    state.alertDistance = Number(

      saved.alertDistance ||
      SYL_CONFIG.ALERT_DISTANCE

    );


    state.soundAlerts = saved.soundAlerts !== false;

    state.vibrationAlerts =
      saved.vibrationAlerts !== false;


    const color = isValidColor(saved.markerColor)

      ? saved.markerColor

      : getSavedMarkerColor();


    if (color) {

      state.markerColor = color;

    }


    if (els.alertDistance) {

      els.alertDistance.value =
        String(state.alertDistance);

    }


    if (els.soundAlerts) {

      els.soundAlerts.checked =
        state.soundAlerts;

    }


    if (els.vibrationAlerts) {

      els.vibrationAlerts.checked =
        state.vibrationAlerts;

    }


    const theme = saved.theme || "light";


    if (els.themeSelect) {

      els.themeSelect.value = theme;

    }


    if (els.markerColor) {

      els.markerColor.value = state.markerColor;

    }


    applyTheme(theme);

    updateMarkerColorPreview(state.markerColor);


  } catch (error) {

    console.warn(
      "Erro ao carregar configurações:",
      error
    );

    applyTheme("light");

  }

}


/* =========================================================
   TEMA
========================================================= */

function applyTheme(theme) {

  const isDark = theme === "dark";

  document.body.classList.toggle(
    "dark-theme",
    isDark
  );

}


/* =========================================================
   NAVEGAÇÃO MOBILE
========================================================= */

function setMobileTab(tab) {

  const validTabs = [
    "home",
    "map",
    "people",
    "settings"
  ];


  if (!validTabs.includes(tab)) return;


  if (tab === "settings") {

    state.previousMobileTab =
      state.mobileTab || "home";


    document.querySelectorAll("[data-mobile-tab]").forEach(button => {

      button.classList.toggle(
        "active",
        button.dataset.mobileTab === "settings"
      );

    });


    openSettings();

    return;

  }


  state.mobileTab = tab;


  if (els.appScreen) {

    els.appScreen.dataset.mobileTab = tab;

  }


  document.querySelectorAll("[data-mobile-tab]").forEach(button => {

    button.classList.toggle(
      "active",
      button.dataset.mobileTab === tab
    );

  });


  if (tab === "map") {

    setTimeout(() => {

      if (!state.map) return;

      state.map.invalidateSize(true);


      if (state.ownPosition) {

        state.map.panTo([

          state.ownPosition.latitude,

          state.ownPosition.longitude

        ]);

      }

    }, 250);

  }


  if (tab === "people") {

    updateNearbyUsers();

  }

}


function restoreMobileTab() {

  const tab = state.mobileTab || "home";


  document.querySelectorAll("[data-mobile-tab]").forEach(button => {

    button.classList.toggle(
      "active",
      button.dataset.mobileTab === tab
    );

  });


  if (els.appScreen) {

    els.appScreen.dataset.mobileTab = tab;

  }


  if (tab === "map") {

    setTimeout(() => {

      state.map?.invalidateSize(true);

    }, 200);

  }

}


/* =========================================================
   CONTADOR DA ABA PESSOAS
========================================================= */

function updateMobileNearbyBadge(count) {

  if (!els.mobileNearbyBadge) return;


  els.mobileNearbyBadge.textContent =
    count > 99 ? "99+" : String(count);


  els.mobileNearbyBadge.style.display =
    count > 0 ? "grid" : "none";

}


/* =========================================================
   MODAIS
========================================================= */

function openExitModal() {

  els.exitModal.classList.remove("hidden");

}


function closeExitModal() {

  els.exitModal.classList.add("hidden");

}


function closeModal(id) {

  const modal = document.getElementById(id);


  if (!modal) return;


  modal.classList.add("hidden");


  if (id === "settingsModal") {

    restoreMobileTab();

  }

}


/* =========================================================
   SAÍDA DO APLICATIVO
========================================================= */

async function exitApplication() {

  if (state.exiting) return;


  state.exiting = true;


  els.confirmExit.disabled = true;


  els.confirmExit.innerHTML = `

    <i class="fa-solid fa-spinner fa-spin"></i>

    Saindo...

  `;


  try {

    stopGeolocation();


    if (
      state.channel &&
      state.presenceEntered
    ) {

      await state.channel.presence.leave();

    }


  } catch (error) {

    console.warn(
      "Erro ao sair da presença:",
      error
    );


  } finally {

    if (state.ably) {

      try {

        state.ably.close();

      } catch (error) {

        console.warn(
          "Erro ao encerrar Ably:",
          error
        );

      }

    }


    resetApplication();

  }

}


/* =========================================================
   ENCERRAR GEOLOCALIZAÇÃO
========================================================= */

function stopGeolocation() {

  if (
    state.watchId !== null &&
    navigator.geolocation
  ) {

    navigator.geolocation.clearWatch(
      state.watchId
    );

    state.watchId = null;

  }


  if (state.positionTimer) {

    clearInterval(state.positionTimer);

    state.positionTimer = null;

  }

}


/* =========================================================
   RESET DO APLICATIVO
========================================================= */

function resetApplication() {

  stopGeolocation();


  if (state.map) {

    state.map.remove();

    state.map = null;

  }


  if (state.ably) {

    try {

      state.ably.close();

    } catch (error) {

      console.warn(error);

    }

  }


  state.ably = null;

  state.channel = null;

  state.clientId = null;


  state.connected = false;

  state.presenceEntered = false;

  state.presenceSubscribed = false;

  state.connecting = false;


  state.ownMarker = null;

  state.ownPosition = null;


  state.remoteMarkers.clear();

  state.remoteUsers.clear();

  state.lastAlertByUser.clear();


  state.profile = null;

  state.mapCentered = false;

  state.exiting = false;


  state.mobileTab = "home";

  state.previousMobileTab = "home";


  if (els.appScreen) {

    els.appScreen.classList.add("hidden");

    delete els.appScreen.dataset.mobileTab;

  }


  els.loginScreen.classList.remove("hidden");

  els.exitModal.classList.add("hidden");

  els.settingsModal.classList.add("hidden");


  els.confirmExit.disabled = false;

  els.confirmExit.innerHTML = `

    <i class="fa-solid fa-power-off"></i>

    Sair

  `;


  els.connectionStatus.textContent = "Desconectado";


  els.gpsStatus.textContent = "Aguardando GPS";

  els.gpsAccuracy.textContent =
    "Precisão ainda não disponível";


  els.gpsIndicator.classList.remove("active");


  els.nearbyCount.textContent = "0";

  els.nearbySummaryCount.textContent = "0";

  updateMobileNearbyBadge(0);


  els.protectionStatus.textContent = "Ativa";


  els.mapStatusText.textContent = "MAPA ATIVO";

  els.lastUpdate.textContent = "Aguardando atualização";


  renderEmptyNearbyUsers();


  els.entryForm.reset();

  updateVehicleFields();


  document.querySelectorAll("[data-mobile-tab]").forEach(button => {

    button.classList.toggle(
      "active",
      button.dataset.mobileTab === "home"
    );

  });


  showToast("Você saiu do SYL com segurança.");

}


/* =========================================================
   STATUS DA CONEXÃO
========================================================= */

function setConnectionStatus(message, connected) {

  els.connectionStatus.textContent = message;


  const dot = document.querySelector(
    ".topbar-live-dot"
  );


  if (dot) {

    dot.style.background = connected
      ? "#1fc98a"
      : "#e6a33d";


    dot.style.boxShadow = connected

      ? "0 0 0 4px rgba(31,201,138,.12)"

      : "0 0 0 4px rgba(230,163,61,.12)";

  }

}


/* =========================================================
   RELÓGIO
========================================================= */

function updateClock() {

  if (!els.clock) return;


  const now = new Date();


  els.clock.textContent = now.toLocaleTimeString(
    "pt-BR",
    {

      hour: "2-digit",

      minute: "2-digit",

      second: "2-digit"

    }
  );

}


/* =========================================================
   NOTIFICAÇÕES
========================================================= */

function showToast(message) {

  if (!els.toast) return;


  els.toast.textContent = message;

  els.toast.classList.add("show");


  clearTimeout(state.toastTimer);


  state.toastTimer = setTimeout(() => {

    els.toast.classList.remove("show");

  }, 3500);

}


/* =========================================================
   SEGURANÇA DE TEXTO
========================================================= */

function escapeHTML(value) {

  return String(value).replace(/[&<>"']/g, character => {

    const entities = {

      "&": "&amp;",

      "<": "&lt;",

      ">": "&gt;",

      '"': "&quot;",

      "'": "&#039;"

    };


    return entities[character];

  });

}
