"use strict";

const storageKey = "gestionperso.mon-stock.v1";
const defaultLocations = ["Congelateur", "Frigo", "Cellier"];
const form = document.querySelector("#stock-form");
const nameInput = document.querySelector("#name");
const quantityInput = document.querySelector("#quantity");
const locationInput = document.querySelector("#location");
const startInput = document.querySelector("#start");
const endInput = document.querySelector("#end");
const saveButton = document.querySelector("#save");
const cancelButton = document.querySelector("#cancel");
const formTitle = document.querySelector("#form-title");
const search = document.querySelector("#search");
const expiringButton = document.querySelector("#expiring");
const locations = document.querySelector("#locations");
const options = document.querySelector("#location-options");
const items = document.querySelector("#items");
const count = document.querySelector("#count");
const feedback = document.querySelector("#feedback");
const numberFormat = new Intl.NumberFormat("fr-FR", { maximumSignificantDigits: 21 });
const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

let stock = { items: [], locations: defaultLocations };
let activeLocation = "";
let editingId = null;

try {
  const saved = JSON.parse(localStorage.getItem(storageKey));
  if (saved) stock = saved;
} catch {
  feedback.textContent = "Impossible de lire le stock enregistré dans ce navigateur.";
  saveButton.disabled = true;
}

function normalize(text) {
  return text.trim().toLocaleLowerCase("fr").normalize("NFD").replace(/\p{M}/gu, "");
}

function dateKey(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatDate(date) {
  return dateFormat.format(new Date(`${date}T00:00:00`));
}

function store(nextStock) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(nextStock));
    stock = nextStock;
    return true;
  } catch {
    feedback.textContent = "Impossible d’enregistrer le stock dans ce navigateur.";
    return false;
  }
}

function renderLocations() {
  options.replaceChildren(...stock.locations.map(location => new Option(location)));

  const buttons = ["", ...stock.locations].map(location => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = location || "Tous les endroits";
    button.setAttribute("aria-pressed", String(location === activeLocation));
    button.addEventListener("click", () => {
      activeLocation = location;
      for (const filter of locations.children) {
        filter.setAttribute("aria-pressed", String(filter === button));
      }
      renderItems();
    });
    return button;
  });
  locations.replaceChildren(...buttons);
}

function resetForm() {
  form.reset();
  endInput.removeAttribute("min");
  nameInput.setCustomValidity("");
  locationInput.setCustomValidity("");
  editingId = null;
  formTitle.textContent = "Ajouter un aliment";
  saveButton.textContent = "Ajouter";
  cancelButton.hidden = true;
}

function edit(item) {
  resetForm();
  editingId = item.id;
  nameInput.value = item.name;
  quantityInput.value = item.quantity;
  locationInput.value = item.location;
  startInput.value = item.start;
  endInput.value = item.end;
  endInput.min = item.start;
  formTitle.textContent = "Modifier un aliment";
  saveButton.textContent = "Enregistrer";
  cancelButton.hidden = false;
  feedback.textContent = "";
  nameInput.focus();
}

function remove(item) {
  if (!window.confirm(`Supprimer « ${item.name} » du stock ?`)) return;
  if (!store({ ...stock, items: stock.items.filter(entry => entry.id !== item.id) })) return;
  if (editingId === item.id) resetForm();
  feedback.textContent = `« ${item.name} » a été supprimé.`;
  renderItems();
  search.focus();
}

function renderItem(item) {
  const article = document.createElement("article");
  article.className = "item";
  const title = document.createElement("h3");
  title.textContent = item.name;
  const details = document.createElement("p");
  details.className = "details";
  const fields = [`Quantité : ${numberFormat.format(item.quantity)}`, item.location];
  if (item.start) fields.push(`Début : ${formatDate(item.start)}`);
  if (item.end) fields.push(`Fin : ${formatDate(item.end)}`);
  details.textContent = fields.join(" · ");

  const actions = document.createElement("div");
  actions.className = "actions";
  const editButton = document.createElement("button");
  editButton.textContent = "Modifier";
  editButton.setAttribute("aria-label", `Modifier ${item.name}`);
  editButton.addEventListener("click", () => edit(item));
  const deleteButton = document.createElement("button");
  deleteButton.textContent = "Supprimer";
  deleteButton.setAttribute("aria-label", `Supprimer ${item.name}`);
  deleteButton.addEventListener("click", () => remove(item));
  actions.append(editButton, deleteButton);
  article.append(title, details, actions);
  return article;
}

function renderItems() {
  const today = new Date();
  const limit = new Date(today);
  limit.setDate(limit.getDate() + 14);
  const earliest = dateKey(today);
  const latest = dateKey(limit);
  const query = normalize(search.value);
  const expiringOnly = expiringButton.getAttribute("aria-pressed") === "true";

  const visible = stock.items.filter(item =>
    (!activeLocation || item.location === activeLocation) &&
    normalize(item.name).includes(query) &&
    (!expiringOnly || (item.end >= earliest && item.end < latest))
  );

  items.replaceChildren(...visible.map(renderItem));
  if (visible.length === 0) {
    count.textContent = stock.items.length ? "Aucun aliment ne correspond aux filtres." : "Votre stock est vide.";
    return;
  }
  count.textContent = visible.length === 1 ? "1 aliment" : `${visible.length} aliments`;
}

for (const input of [nameInput, locationInput]) {
  input.addEventListener("input", () => input.setCustomValidity(""));
}
startInput.addEventListener("input", () => { endInput.min = startInput.value; });
cancelButton.addEventListener("click", () => {
  resetForm();
  feedback.textContent = "";
  nameInput.focus();
});

form.addEventListener("submit", event => {
  event.preventDefault();
  const name = nameInput.value.trim();
  const typedLocation = locationInput.value.trim();
  nameInput.setCustomValidity(name ? "" : "Indiquez un libellé.");
  locationInput.setCustomValidity(typedLocation ? "" : "Indiquez un endroit de stockage.");
  if (!form.reportValidity()) return;

  const existingLocation = stock.locations.find(location => normalize(location) === normalize(typedLocation));
  const item = {
    id: editingId ?? crypto.randomUUID(),
    name,
    quantity: quantityInput.valueAsNumber,
    start: startInput.value,
    end: endInput.value,
    location: existingLocation ?? typedLocation
  };
  const nextStock = {
    items: editingId ? stock.items.map(entry => entry.id === editingId ? item : entry) : [...stock.items, item],
    locations: existingLocation ? stock.locations : [...stock.locations, item.location]
  };
  if (!store(nextStock)) return;

  feedback.textContent = editingId ? `« ${name} » a été modifié.` : `« ${name} » a été ajouté.`;
  resetForm();
  renderLocations();
  renderItems();
  nameInput.focus();
});

search.addEventListener("input", renderItems);
expiringButton.addEventListener("click", () => {
  const pressed = expiringButton.getAttribute("aria-pressed") === "true";
  expiringButton.setAttribute("aria-pressed", String(!pressed));
  renderItems();
});

renderLocations();
renderItems();
