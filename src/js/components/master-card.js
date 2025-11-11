/**
 * Master Card - Steam-like card hover effect
 * Creates an interactive 3D tilt effect on hover, similar to Steam trading cards
 */
(function initMasterCard() {
  const card = document.querySelector(".master__card");
  const container = document.querySelector(".master__container");

  if (!card) return;

  let isHovered = false;
  let currentX = 0;
  let currentY = 0;
  let targetX = 0;
  let targetY = 0;

  // Расширенная зона наведения (в пикселях) - создает буфер вокруг карточки
  const hoverPadding = 80;

  // Smooth animation for tilt effect
  const animate = () => {
    // Easing for smooth movement
    currentX += (targetX - currentX) * 0.1;
    currentY += (targetY - currentY) * 0.1;

    if (isHovered) {
      const rotateX = currentY * 8; // Max 8 degrees tilt
      const rotateY = currentX * 8;

      card.style.transform = `
        translateZ(2.5rem)
        rotateX(${-rotateX}deg)
        rotateY(${rotateY}deg)
      `;

      requestAnimationFrame(animate);
    } else {
      // Smooth return to default position
      const threshold = 0.01;
      if (Math.abs(currentX) > threshold || Math.abs(currentY) > threshold) {
        currentX += (0 - currentX) * 0.15;
        currentY += (0 - currentY) * 0.15;

        const rotateX = currentY * 8;
        const rotateY = currentX * 8;

        card.style.transform = `
          translateY(-2rem)
          scale(1.05)
          rotateX(${-rotateX}deg)
          rotateY(${rotateY}deg)
        `;

        requestAnimationFrame(animate);
      } else {
        // Reset to default
        currentX = 0;
        currentY = 0;
        targetX = 0;
        targetY = 0;
        card.style.transform = "";
        card.classList.remove("is-hovered");
      }
    }
  };

  // Проверка, находится ли мышь в расширенной зоне наведения
  const isInHoverZone = (x, y) => {
    const rect = card.getBoundingClientRect();
    const expandedLeft = rect.left - hoverPadding;
    const expandedRight = rect.right + hoverPadding;
    const expandedTop = rect.top - hoverPadding;
    const expandedBottom = rect.bottom + hoverPadding;

    return (
      x >= expandedLeft &&
      x <= expandedRight &&
      y >= expandedTop &&
      y <= expandedBottom
    );
  };

  const handleMouseMove = (e) => {
    const rect = card.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Проверяем, находимся ли в расширенной зоне наведения
    const inHoverZone = isInHoverZone(e.clientX, e.clientY);

    if (inHoverZone && !isHovered) {
      // Входим в зону наведения
      isHovered = true;
      card.classList.add("is-hovered");
      animate();
    } else if (!inHoverZone && isHovered) {
      // Выходим из зоны наведения
      isHovered = false;
      targetX = 0;
      targetY = 0;
      animate();
    }

    if (isHovered) {
      // Calculate mouse position relative to card center (-1 to 1)
      targetX = (e.clientX - centerX) / (rect.width / 2);
      targetY = (e.clientY - centerY) / (rect.height / 2);

      // Clamp values to prevent extreme tilting
      targetX = Math.max(-1, Math.min(1, targetX));
      targetY = Math.max(-1, Math.min(1, targetY));
    }
  };

  // Обработчик ухода мыши с контейнера
  const handleMouseLeave = () => {
    if (isHovered) {
      isHovered = false;
      targetX = 0;
      targetY = 0;
      animate();
    }
  };

  // Отслеживаем движение мыши на контейнере для расширенной зоны
  const parentElement = container || card.parentElement;
  if (parentElement) {
    parentElement.addEventListener("mousemove", handleMouseMove);
    parentElement.addEventListener("mouseleave", handleMouseLeave);
  } else {
    // Fallback на саму карточку, если контейнер не найден
    card.addEventListener("mousemove", handleMouseMove);
    card.addEventListener("mouseleave", handleMouseLeave);
  }
})();
