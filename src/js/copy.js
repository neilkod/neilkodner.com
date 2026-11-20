// Copy-address buttons. The mailto link next to each button works without this.
for (const btn of document.querySelectorAll("button[data-copy]")) {
  btn.addEventListener("click", async () => {
    const text = btn.dataset.copy;
    const label = btn.textContent;
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = "Copied";
    } catch {
      const range = document.createRange();
      const target = btn.closest("section, div")?.querySelector(".big-mail");
      if (target) {
        range.selectNodeContents(target);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
      btn.textContent = "Selected, press Copy";
    }
    setTimeout(() => (btn.textContent = label), 2400);
  });
}
