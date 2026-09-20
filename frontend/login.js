(() => {
  "use strict";

  const API_BASE_URL = window.SDN_API_BASE_URL || "/api";

  const form = document.getElementById("loginForm");
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const passwordField = document.getElementById("passwordField");
  const submitButton = document.getElementById("loginSubmit");
  const message = document.getElementById("loginMessage");
  const clock = document.getElementById("loginClock");

  function normalize(value) {
    return String(value || "").trim().toLowerCase();
  }

  function showMessage(text, type = "") {
    if (!message) return;

    message.textContent = text;
    message.className = `login-message ${type}`;
  }

  function clearMessage() {
    if (!message) return;

    message.textContent = "";
    message.className = "login-message";
  }

  function nowTs() {
    const d = new Date();

    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    const s = String(d.getSeconds()).padStart(2, "0");

    return `${h}:${m}:${s}`;
  }

  function tickClock() {
    if (clock) {
      clock.textContent = nowTs();
    }
  }

  function enterSystem(callback) {
    document.body.classList.add("login-exiting");

    setTimeout(() => callback(), 650);
  }

  async function fetchAgentData(token, login) {
    const response = await fetch(`${API_BASE_URL}/Agents`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error("Não foi possível carregar os dados do agente.");
    }

    const agents = await response.json();

    return agents.find(
      agent => normalize(agent.login) === normalize(login)
    ) || null;
  }

  async function performLogin(username, password) {
    const body = {
      username
    };

    if (password) {
      body.password = password;
    }

    const response = await fetch(`${API_BASE_URL}/Auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    let data = null;

    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      const errorMessage =
        typeof data === "string"
          ? data
          : data?.title || "Credencial inválida.";

      throw new Error(errorMessage);
    }

    return data;
  }

  async function login() {
    const username = normalize(usernameInput.value);
    const password = passwordInput.value;

    if (!username) {
      showMessage("IDENTIFICAÇÃO NÃO INFORMADA.", "error");
      usernameInput.focus();
      return;
    }

    const isStaff =
      username === "dispatcher" ||
      username === "mestre";

    if (isStaff && !password) {
      showMessage("SENHA NÃO INFORMADA.", "error");
      passwordInput.focus();
      return;
    }

    submitButton.disabled = true;
    clearMessage();

    try {
      const data = await performLogin(username, password);

      sessionStorage.setItem(
        "sdn-session",
        JSON.stringify({
          type: data.role,
          username: data.username,
          token: data.token,
          expiresAt: data.expiresAt,
          loginAt: Date.now()
        })
      );

      if (data.role === "master") {
        showMessage(
          "ACESSO AUTORIZADO // MESTRE",
          "success"
        );

        enterSystem(() => {
          window.location.href = "mestre.html";
        });

        return;
      }

      if (data.role === "dispatcher") {
        showMessage(
          "ACESSO AUTORIZADO // DISPATCHER",
          "success"
        );

        enterSystem(() => {
          window.location.href = "dispatcher.html";
        });

        return;
      }

      if (data.role === "player") {
        const agent = await fetchAgentData(
          data.token,
          data.username
        );

        if (!agent) {
          throw new Error(
            "Sessão criada, mas unidade não encontrada."
          );
        }

        if (typeof sdnSendLogin === "function") {
          sdnSendLogin(agent.login);
        }

        sessionStorage.setItem(
          "sdn-session",
          JSON.stringify({
            type: "player",
            username: data.username,
            agentLogin: agent.login,
            agentName: agent.name,
            agentId: agent.id,
            token: data.token,
            expiresAt: data.expiresAt,
            loginAt: Date.now()
          })
        );

        showMessage(
          `IDENTIFICAÇÃO CONFIRMADA // ${agent.name.toUpperCase()}`,
          "success"
        );

        enterSystem(() => {
          window.location.href = "jogadores.html";
        });

        return;
      }

      throw new Error("Tipo de acesso desconhecido.");

    } catch (error) {
      sessionStorage.removeItem("sdn-session");

      showMessage(
        error.message || "ERRO DE AUTENTICAÇÃO.",
        "error"
      );

      passwordInput.value = "";
      usernameInput.focus();

    } finally {
      submitButton.disabled = false;
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    login();
  });

  usernameInput.addEventListener("input", () => {
    clearMessage();

    const username = normalize(usernameInput.value);

    if (
      username === "dispatcher" ||
      username === "mestre"
    ) {
      passwordInput.placeholder =
        username === "mestre"
          ? "SENHA DO MESTRE"
          : "SENHA DO DISPATCHER";

      if (passwordField) {
        passwordField.classList.remove("player-password");
      }

      return;
    }

    passwordInput.placeholder = "NÃO NECESSÁRIA PARA AGENTES";

    if (passwordField) {
      passwordField.classList.add("player-password");
    }
  });

  tickClock();
  setInterval(tickClock, 1000);

  usernameInput.focus();
})();
