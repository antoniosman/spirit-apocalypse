// Canonical cast metadata copied from Spirit Slasher app.js (v1.26.0).
// Source: https://github.com/antoniosman/spirit-slasher/blob/main/app.js
const characterGenders = {
  Alex: "female", Billy: "male", Catherine: "female", Demarin: "female",
  Elisa: "female", Ester: "female", Eva: "female", Evelyn: "female",
  Evaggelia: "female", Hope: "female", Ian: "male", Irene: "female", Jasmine: "female", Luna: "female", Paul: "male",
  Pauline: "female", Phillip: "male", Rino: "male", Sargenie: "male",
  Smaragda: "female", Sorina: "female", Tony: "male", Vicky: "female",
  Vincent: "male", Violet: "female", Zoe: "female"
};
function isFemale(name) { return characterGenders[name] === "female"; }
function subjectName(name, lower = false) { const article = isFemale(name) ? (lower ? "η" : "Η") : (lower ? "ο" : "Ο"); return `${article} ${name}`; }
function accusativeName(name) { return `${isFemale(name) ? "την" : "τον"} ${name}`; }
function toName(name) { return `${isFemale(name) ? "στην" : "στον"} ${name}`; }
function genitiveName(name) { return `${isFemale(name) ? "της" : "του"} ${name}`; }
function genderWord(name, male, female) { return isFemale(name) ? female : male; }

const characterPronouns = Object.fromEntries(Object.entries(characterGenders).map(([name,gender])=>[name,gender==='female'?{subject:'she',object:'her',possessive:'her',label:'she/her'}:{subject:'he',object:'him',possessive:'his',label:'he/him'}]));

