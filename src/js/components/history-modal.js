const MODAL_OPEN_CLASS = "history-modal--open";
const BODY_LOCK_CLASS = "history-modal-open";

function getModalElement(context) {
  if (!context) return null;
  if (context.matches?.("[data-history-modal]")) {
    return context;
  }
  return context.querySelector?.("[data-history-modal]") || null;
}

function bindEvents({ modal, triggers }) {
  const overlay = modal.querySelector(".history-modal__overlay");
  const closeButtons = modal.querySelectorAll("[data-history-close]");

  const open = (event) => {
    event?.preventDefault?.();
    modal.classList.add(MODAL_OPEN_CLASS);
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add(BODY_LOCK_CLASS);
  };

  const close = () => {
    modal.classList.remove(MODAL_OPEN_CLASS);
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove(BODY_LOCK_CLASS);
  };

  const onKeyDown = (event) => {
    if (event.key === "Escape") {
      close();
    }
  };

  triggers.forEach((trigger) => trigger.addEventListener("click", open));
  closeButtons.forEach((btn) => btn.addEventListener("click", close));
  overlay?.addEventListener("click", close);
  document.addEventListener("keydown", onKeyDown);

  return () => {
    triggers.forEach((trigger) => trigger.removeEventListener("click", open));
    closeButtons.forEach((btn) => btn.removeEventListener("click", close));
    overlay?.removeEventListener("click", close);
    document.removeEventListener("keydown", onKeyDown);
  };
}

export function initHistoryModal(context = document) {
  const modal = getModalElement(context);
  const triggers = Array.from(
    document.querySelectorAll?.("[data-history-open]") || []
  );

  if (!modal || !triggers.length) {
    return null;
  }

  const unbind = bindEvents({ modal, triggers });

  return {
    destroy() {
      unbind();
    },
  };
}

export default {
  initHistoryModal,
};
