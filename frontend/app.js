const USER_ID = "6aa5b53fe711c4a28ae539bd";

// Esperar a que la página cargue para evitar errores de conexión con el HTML
document.addEventListener('DOMContentLoaded', () => {
  const thread = document.querySelector('.thread');
  const form = document.querySelector('.composer');
  const input = document.querySelector('.composer__input');

  // Función para imprimir mensajes
  function renderMessage(text, sender) {
    if (!thread) return;
    const bubble = document.createElement('div');
    bubble.classList.add('bubble', `bubble--${sender}`);
    bubble.textContent = text;
    thread.appendChild(bubble);
    thread.scrollTop = thread.scrollHeight; 
  }

  // 1. Mensaje inicial por defecto
  renderMessage("Hola, soy tu Liquidity Copilot de Banorte. ¿En qué te puedo ayudar hoy?", 'agent');

  // 2. Lógica de envío de mensajes
  // Lógica de envío de mensajes
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const message = input.value.trim();
      if (!message) return;

      // 1. Mostrar lo que el usuario escribió
      renderMessage(message, 'user');
      input.value = '';

      // 2. Mostrar animación de "escribiendo..."
      const thread = document.querySelector('.thread');
      const loader = document.createElement('div');
      loader.id = 'agent-loading';
      loader.classList.add('typing-indicator');
      loader.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
      thread.appendChild(loader);
      thread.scrollTop = thread.scrollHeight;

      try {
        // 3. Esperar la respuesta de Gemini
        const response = await fetch('http://localhost:3000/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: USER_ID, message: message })
        });

        const data = await response.json();
        
        // 4. Quitar la animación de "escribiendo..."
        document.getElementById('agent-loading')?.remove();
        
        // 5. Mostrar la respuesta final
        renderMessage(data.reply, 'agent');

        // ⚡ A2UI: Si la IA manda actualizar el dashboard
        if (data.dashboardUpdates && data.dashboardUpdates.highlightedPlan === "12") {
          document.querySelectorAll('.bar-item').forEach(el => el.classList.remove('bar-item--recommended'));
          const tarjetas = Array.from(document.querySelectorAll('.bar-item'));
          const plan12 = tarjetas.find(el => el.textContent.includes('12 Meses'));
          if (plan12) plan12.classList.add('bar-item--recommended');
        }

      } catch (error) {
        console.error("Error conectando al backend:", error);
        document.getElementById('agent-loading')?.remove();
        renderMessage("Error de conexión al servidor.", 'agent');
      }
    });
  }

  // 3. Botones del Dashboard hacia el Chat
  document.querySelectorAll('[data-action-prompt]').forEach(button => {
    button.addEventListener('click', (e) => {
      const promptTexto = e.currentTarget.getAttribute('data-action-prompt');
      if (input) input.value = promptTexto;
      if (form) form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    });
  });
});