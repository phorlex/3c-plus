async function loadConfig() {
  const status = document.querySelector("#status");
  const input = document.querySelector("#integrationUrl");
  const copyButton = document.querySelector("#copyButton");

  try {
    const response = await fetch("/api/config");
    const config = await response.json();
    input.value = config.integrationUrl;
    status.textContent = config.configured
      ? "Pipefy configurado"
      : "Configure PIPEFY_TOKEN e PIPEFY_PIPE_ID no .env";
    status.classList.toggle("ready", config.configured);

    copyButton.addEventListener("click", async () => {
      await navigator.clipboard.writeText(input.value);
      copyButton.textContent = "Copiado";
      setTimeout(() => {
        copyButton.textContent = "Copiar";
      }, 1800);
    });
  } catch (error) {
    status.textContent = "Nao foi possivel carregar a configuracao";
    input.value = "";
  }
}

loadConfig();
