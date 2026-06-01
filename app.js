const LEGACY_STORAGE_KEY = "santispells-state-v1";
const PROFILES_KEY = "santispells-profiles-v1";
const ACTIVE_PROFILE_KEY = "santispells-active-profile-v1";

const defaultMaxByClass = {
  sorcerer: [4, 3, 3, 3, 2, 1, 1, 1, 1],
  cleric: [4, 3, 3, 3, 2, 1, 1, 1, 1],
  druid: [4, 3, 3, 3, 2, 1, 1, 1, 1],
  wizard: [4, 3, 3, 3, 2, 1, 1, 1, 1],
  ranger: [4, 3, 3, 0, 0, 0, 0, 0, 0],
  warlock: [0, 0, 0, 0, 0, 0, 0, 0, 0],
};

const classSelect = document.querySelector("#classSelect");
const characterName = document.querySelector("#characterName");
const profileSelect = document.querySelector("#profileSelect");
const loadProfileBtn = document.querySelector("#loadProfileBtn");
const deleteProfileBtn = document.querySelector("#deleteProfileBtn");
const slotsGrid = document.querySelector("#slotsGrid");
const slotTemplate = document.querySelector("#slotTemplate");
const saveStatus = document.querySelector("#saveStatus");
const restoreAllBtn = document.querySelector("#restoreAllBtn");
const emptyAllBtn = document.querySelector("#emptyAllBtn");
const resetBtn = document.querySelector("#resetBtn");
const pactLevel = document.querySelector("#pactLevel");
const pactMax = document.querySelector("#pactMax");
const pactRemaining = document.querySelector("#pactRemaining");
const pactMinusBtn = document.querySelector("#pactMinusBtn");
const pactPlusBtn = document.querySelector("#pactPlusBtn");
const pactRestoreBtn = document.querySelector("#pactRestoreBtn");

let profiles = loadProfiles();
let activeProfileKey = loadActiveProfileKey();
let state = profiles[activeProfileKey] ?? createDefaultState();

function createDefaultState() {
  return {
    characterName: "",
    className: "wizard",
    slots: defaultMaxByClass.wizard.map((max) => ({ max, remaining: max })),
    classSlots: {},
    pact: {
      level: 1,
      max: 1,
      remaining: 1,
    },
  };
}

function loadProfiles() {
  try {
    const savedProfiles = JSON.parse(localStorage.getItem(PROFILES_KEY));
    if (savedProfiles && typeof savedProfiles === "object" && Object.keys(savedProfiles).length) {
      return Object.fromEntries(
        Object.entries(savedProfiles).map(([key, profile]) => [key, normalizeState(profile)]),
      );
    }

    const legacyState = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY));
    if (legacyState) {
      const normalized = normalizeState(legacyState);
      return { [profileKey(normalized.characterName)]: normalized };
    }
  } catch {
    // Fall through to a clean first profile.
  }

  return { default: createDefaultState() };
}

function loadActiveProfileKey() {
  const saved = localStorage.getItem(ACTIVE_PROFILE_KEY);
  if (saved && profiles[saved]) return saved;
  return Object.keys(profiles)[0] ?? "default";
}

function normalizeState(saved) {
  const base = createDefaultState();
  return {
    ...base,
    ...(saved ?? {}),
    slots: normalizeSlots(saved?.slots ?? base.slots),
    pact: { ...base.pact, ...(saved?.pact ?? {}) },
    classSlots: saved?.classSlots ?? {},
  };
}

function profileKey(name) {
  return name.trim().toLowerCase().replace(/\s+/g, "-") || "default";
}

function normalizeSlots(slots) {
  return Array.from({ length: 9 }, (_, index) => {
    const item = slots[index] ?? {};
    const max = clampNumber(item.max ?? 0, 0, 12);
    const remaining = clampNumber(item.remaining ?? max, 0, max);
    return { max, remaining };
  });
}

function saveState() {
  profiles[activeProfileKey] = state;
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
  localStorage.setItem(ACTIVE_PROFILE_KEY, activeProfileKey);
  saveStatus.textContent = `Salvato ${new Date().toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function loadOrCreateProfile(name) {
  const cleanName = name.trim();
  const nextKey = profileKey(cleanName);
  profiles[activeProfileKey] = state;

  if (profiles[nextKey]) {
    activeProfileKey = nextKey;
    state = profiles[nextKey];
  } else {
    activeProfileKey = nextKey;
    state = createDefaultState();
    state.characterName = cleanName;
    profiles[nextKey] = state;
  }

  saveAndRender();
}

function deleteActiveProfile() {
  if (Object.keys(profiles).length <= 1) {
    state = createDefaultState();
    profiles = { default: state };
    activeProfileKey = "default";
    saveAndRender();
    return;
  }

  delete profiles[activeProfileKey];
  activeProfileKey = Object.keys(profiles)[0];
  state = profiles[activeProfileKey];
  saveAndRender();
}

function clampNumber(value, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return min;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

function setClass(className) {
  state.classSlots[state.className] = state.slots;
  state.className = className;
  state.slots = normalizeSlots(
    state.classSlots[className] ?? defaultMaxByClass[className].map((max) => ({ max, remaining: max })),
  );
  document.body.dataset.class = className;
  classSelect.value = className;
  saveAndRender();
}

function changeSlot(levelIndex, delta) {
  const slot = state.slots[levelIndex];
  slot.remaining = clampNumber(slot.remaining + delta, 0, slot.max);
  saveAndRender();
}

function setSlotMax(levelIndex, value) {
  const slot = state.slots[levelIndex];
  slot.max = clampNumber(value, 0, 12);
  slot.remaining = clampNumber(slot.remaining, 0, slot.max);
  saveAndRender();
}

function restoreAll() {
  state.slots = state.slots.map((slot) => ({ ...slot, remaining: slot.max }));
  state.pact.remaining = state.pact.max;
  saveAndRender();
}

function emptyAll() {
  state.slots = state.slots.map((slot) => ({ ...slot, remaining: 0 }));
  state.pact.remaining = 0;
  saveAndRender();
}

function resetState() {
  const className = state.className;
  state = createDefaultState();
  state.className = className;
  state.slots = defaultMaxByClass[className].map((max) => ({ max, remaining: max }));
  saveAndRender();
}

function changePact(delta) {
  state.pact.remaining = clampNumber(state.pact.remaining + delta, 0, state.pact.max);
  saveAndRender();
}

function setPactMax(value) {
  state.pact.max = clampNumber(value, 0, 8);
  state.pact.remaining = clampNumber(state.pact.remaining, 0, state.pact.max);
  saveAndRender();
}

function renderSlots() {
  slotsGrid.innerHTML = "";

  state.slots.forEach((slot, index) => {
    const level = index + 1;
    const node = slotTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector("h3").textContent = `Livello ${level}`;
    node.querySelector(".slot-fraction").textContent = `${slot.remaining}/${slot.max}`;
    node.querySelector(".remaining").textContent = slot.remaining;
    node.querySelector(".minus").addEventListener("click", () => changeSlot(index, -1));
    node.querySelector(".plus").addEventListener("click", () => changeSlot(index, 1));

    const maxInput = node.querySelector(".max-input");
    maxInput.value = slot.max;
    maxInput.addEventListener("change", () => setSlotMax(index, maxInput.value));

    slotsGrid.append(node);
  });
}

function renderPact() {
  pactLevel.innerHTML = "";
  for (let level = 1; level <= 5; level += 1) {
    const option = document.createElement("option");
    option.value = String(level);
    option.textContent = `Livello ${level}`;
    pactLevel.append(option);
  }

  pactLevel.value = String(state.pact.level);
  pactMax.value = state.pact.max;
  pactRemaining.textContent = state.pact.remaining;
}

function renderProfiles() {
  profileSelect.innerHTML = "";

  Object.entries(profiles)
    .sort(([, a], [, b]) => (a.characterName || "").localeCompare(b.characterName || "", "it"))
    .forEach(([key, profile]) => {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = profile.characterName || "Senza nome";
      profileSelect.append(option);
    });

  profileSelect.value = activeProfileKey;
}

function render() {
  document.body.dataset.class = state.className;
  classSelect.value = state.className;
  characterName.value = state.characterName;
  renderProfiles();
  renderSlots();
  renderPact();
}

function saveAndRender() {
  state.classSlots[state.className] = state.slots;
  saveState();
  render();
}

classSelect.addEventListener("change", () => setClass(classSelect.value));

characterName.addEventListener("input", () => {
  state.characterName = characterName.value;
  saveState();
  renderProfiles();
});

profileSelect.addEventListener("change", () => {
  profiles[activeProfileKey] = state;
  activeProfileKey = profileSelect.value;
  state = profiles[activeProfileKey];
  saveAndRender();
});

loadProfileBtn.addEventListener("click", () => loadOrCreateProfile(characterName.value));
deleteProfileBtn.addEventListener("click", deleteActiveProfile);

restoreAllBtn.addEventListener("click", restoreAll);
emptyAllBtn.addEventListener("click", emptyAll);
resetBtn.addEventListener("click", resetState);
pactMinusBtn.addEventListener("click", () => changePact(-1));
pactPlusBtn.addEventListener("click", () => changePact(1));
pactRestoreBtn.addEventListener("click", () => {
  state.pact.remaining = state.pact.max;
  saveAndRender();
});
pactLevel.addEventListener("change", () => {
  state.pact.level = clampNumber(pactLevel.value, 1, 5);
  saveAndRender();
});
pactMax.addEventListener("change", () => setPactMax(pactMax.value));

render();
