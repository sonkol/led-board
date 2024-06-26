"use strict";
// Constant definitions
const SETTINGS = {
  "animationSpeed": 100, // Speed of marqee in some arbitrary units
  "offlineLimit": 90, // After this count of seconds without refresh, display error message
  "prefix": "https://api.golemio.cz/v2/pid/departureboards/?", // General purpose URL
  "preset": "https://s.golemio.cz/pid/", // URL for presets
  "rowLimit": {
    "min": 4,
    "max": 6
  },
  "httpTimeout": 20, // seconds
  "speechSpeed": 1 // Speed of speech (default is 1)
}

const STRINGS = {
  "marqueeJoiner": " • ", // String with which to join information texts 
  "dayOfWeek": ["neděle", "pondělí", "úterý", "středa", "čtvrtek", "pátek", "sobota"], // Dictionary of week days
  "http400Message": "Chybný dotaz.<br>Nechybí ID zastávky?",
  "http401Message": "Problém s API klíčem<br>Nesprávný nebo chybějící API klíč. Pro získání API klíče se zaregistrujte u Golemia.",
  "http404Message": "Zastávka je nyní bez provozu",
  "offlineText": "<p>Omlouváme se, zařízení je dočasně mimo provoz</p><p>Aktuální odjezdy spojů naleznete na webu pid.cz/odjezdy</p>",
}

// Here belong program relevant settings and general variables
let settings = {
  "showPlatformNumbers": false,
  "offlineCounter": 0,
  "reading": false, // Is text-to-speech reading underway?
  "infotextContent": undefined
}

// Data from API will go here
let data = "";

// Default settings of URL parameters, are relevant to Golemio API parameters
const PARAMETERS = {
  "airCondition": true,
  "aswIds": "539_1",
  "filter": "routeHeadingOnce",
  "limit": 5, // Number of lines: 1-6
  "skip": "atStop",
  "minutesAfter": 99,  // Minutes in the future to display departures: 0-1440
  "displayWidth": 384, // Width of the LED matrix in px: 370-384
  "preset": undefined
}

// Make a copy of parameters which can be edited
let parameters = structuredClone(PARAMETERS);

// Lock it so no unauthorized values cannot be added
Object.seal(parameters);

// Get parameters from the URL
let searchString = new URLSearchParams(document.location.search);
for (const [key, value] of searchString) {
  try {
    parameters[key] = value;
  }
  catch {
    continue;
  };
}

// Assure that user input is correct, if not, replace with default values
if (!["true", "false"].includes(parameters.airCondition)) parameters.airCondition = PARAMETERS.airCondition;
if (!/^[1-9][0-9]{0,4}(_\d{1,3})?$/.test(parameters.aswIds)) parameters.aswIds = PARAMETERS.aswIds;
if (!["none", "routeOnce", "routeHeadingOnce", "routeOnceFill", "routeHeadingOnceFill", "routeHeadingOnceNoGap", "routeHeadingOnceNoGapFill"].includes(parameters.filter)) parameters.filter = PARAMETERS.filter;
parameters.limit = (parameters.limit.length === 0) ? PARAMETERS.limit : Math.min(Math.max(parameters.limit, 0), 6); // Clamp number of displayed lines
parameters.minutesAfter = (Number.isInteger(Number.parseInt(parameters.minutesAfter))) ? Math.min(Math.max(parameters.minutesAfter, 0), 1440) : PARAMETERS.minutesAfter; // Clamp minutesAfter
parameters.displayWidth = (Number.isInteger(Number.parseInt(parameters.displayWidth))) ? Math.min(Math.max(parameters.displayWidth, 370), 384) : PARAMETERS.displayWidth;
if (/^[a-zA-Z0-9_-]$/.test(parameters.preset)) parameters.preset = PARAMETERS.preset;

// Set font size
updateFontSize();

// Construct query string
const queryString = new URLSearchParams(parameters);

// Fill table with content for the first time
getData(queryString);
updateClock();

function getData(queryString) {
  try {
    const httpRequest = new XMLHttpRequest();
    httpRequest.timeout = SETTINGS.httpTimeout * 1000; // Expects miliseconds
    let urlBase = SETTINGS.prefix;
    if (parameters.preset === undefined) {
      queryString.delete("preset");
    }
    else {
      queryString = queryString.get("preset");
      urlBase = SETTINGS.preset;
    }
    httpRequest.open("GET", urlBase + queryString.toString());
    httpRequest.setRequestHeader("Content-Type", "application/json; charset=utf-8");
    httpRequest.setRequestHeader("x-access-token", KEY);
    httpRequest.onreadystatechange = function () {
      // ReadyState 4 = done, HTTP 200 = OK
      if (this.readyState === 4) {
        // Continue on success (200) or process errors
        switch (httpRequest.status) {
          case 200:
            // Reset counter when connection successful and remove offline message
            settings.offlineCounter = 0;
            data = JSON.parse(this.responseText);
            updateContent(data);
            break;
          case 400: // Malformed query
            fullScreenMessage(STRINGS.http400Message);
            break;
          case 401: // No API key
            fullScreenMessage(STRINGS.http401Message);
            break;
          case 404: // Stop does not exist. Either wrong ASW ID or the stop was cancelled  
            fullScreenMessage(STRINGS.http404Message);
            break;
          case 0:
            if (settings.offlineCounter > SETTINGS.offlineLimit) fullScreenMessage(STRINGS.offlineText);
            break;
          default:
            fullScreenMessage(STRINGS.offlineText);
            console.error("HTTP error" + httpRequest.status + " " + httpRequest.statusText);
        }
      }
    }
    httpRequest.send();
  }
  catch (e) {
    fullScreenMessage();
  }
}

// Create rows with departures and insert them into document
function updateContent(data) {

  // Process information texts. If a full page infotext is present, do not render departures
  const isGlobalInfotext = processInfoTexts(data.infotexts);
  if (isGlobalInfotext) return;

  // If multiple stops are to be displayed, platform numbers will be shown. First get the number of stops
  const uniqueStops = new Set();
  data.stops.forEach((stop) => {
    uniqueStops.add(stop.asw_id.node + "/" + stop.asw_id.stop);
  });

  // Then print the platform numbers when more then one stop to display
  settings.showPlatformNumbers = (uniqueStops.size > 1) ? true : false;
  
  // Set the mumber of rows according to the content if using preset, within prescribed bounds
  if (parameters.preset.length > 0) {
    parameters.limit = Math.min(Math.max(data.departures.length, SETTINGS.rowLimit.min), SETTINGS.rowLimit.max);
    updateFontSize();
  }

  // Start placing departures into the table
  const body = document.getElementsByTagName("main")[0];
  body.replaceChildren();
  let counter = 1;
  for (const row of data.departures) {
    if (counter > parameters.limit) break;
    counter++;
    printDepartureRow(row, body);
  }
}

function printDepartureRow(row, body) {
  const route = document.createElement("div");
  route.classList.add("route");
  route.textContent = row.route.short_name;
  body.appendChild(route);
  /* Shrinks route number if overflows */
  if (route.scrollWidth > route.clientWidth) {
    route.style.fontSize = route.clientWidth / route.scrollWidth * 100 + "%";
  }

  const accessible = document.createElement("div");
  accessible.classList.add("accessible");
  if (row.trip.is_wheelchair_accessible) accessible.classList.add("true");
  body.appendChild(accessible);

  const airCondition = document.createElement("div");
  airCondition.classList.add("aircondition");
  if (row.trip.is_air_conditioned) airCondition.classList.add("true");
  body.appendChild(airCondition);

  if (settings.showPlatformNumbers) {
    const platform = document.createElement("div");
    platform.classList.add("platform");
    platform.textContent = row.stop.platform_code;
    body.appendChild(platform);
  }

  const arrival = document.createElement("div");
  arrival.classList.add("arrival");
  arrival.textContent = row.departure_timestamp.minutes;
  body.appendChild(arrival);

  /* Headsign is inserted last because we need to know the width of its field */
  const headsign = document.createElement("div");
  headsign.classList.add("headsign");
  row.trip.headsign = row.trip.headsign;
  headsign.textContent = prettyPrint(row.trip.headsign);
  body.insertBefore(headsign, airCondition.nextSibling);
  /* Shrinks destination stop name if overflows */
  if (headsign.scrollWidth > headsign.clientWidth) {
    headsign.style.fontSize = headsign.clientWidth / headsign.scrollWidth * 100 + "%";
  }
}

function processInfoTexts(data) {
  let inline = false,          // These are switches 
    general = false,           // that are used to check 
    general_alternate = false, // what type of board is active
    referenceString = "";

  // Here the strings will be stored   
  let infotexts = {
    "inline": [],
    "general": []
  };

  // Separate inline and fullscreen infotexts
  for (const text of data) {
    if (text.display_type === "inline") {
      if (text.text) infotexts.inline.push(text.text.trim());
      if (text.text_en) infotexts.inline.push(text.text_en.trim());
      inline = true;
    }
    else {
      if (text.text) infotexts.general.push(text.text.trim());
      if (text.text_en) infotexts.general.push(text.text_en.trim());
      // Selects the correct display mode TODO support for alternate
      (text.display_type === "general-alternate") ? general_alternate = true : general = true;
    }

    // This will be used to compare if infotexts from previous refresh changed
    referenceString += text.display_type + text.text + text.text_en;
  }

  /* If the text content and infotext types are the same, do not redraw it again. This is to
  prevent skipping or stuttering */
  if (referenceString === settings.infotextContent) {
    return general === true;
  }

  // Update the string for future comparision
  settings.infotextContent = referenceString

  // One-liners
  const infotextBar = document.getElementById("infotext");
  const dateBar = document.getElementById("date");
  if (inline) {

    // Non-overflowing (short) information text is static
    infotextBar.innerHTML = infotexts.inline.join(STRINGS.marqueeJoiner);
    infotextBar.style.display = "flex";
    dateBar.style.display = "none";
    if (infotextBar.scrollWidth > infotextBar.clientWidth) {
      makeMarquee(infotextBar, infotexts.inline.join(STRINGS.marqueeJoiner));
    }
  }
  else {
    // Restore display to normal state
    infotextBar.style.display = "none";
    dateBar.style.display = "flex";
  }

  // Full screen messages
  if (general || general_alternate) {
    settings.infotextGeneral = true;
    fullScreenMessage(infotexts.general.join(STRINGS.marqueeJoiner));

    const fullScreenInfotext = document.getElementById("fullscreen-text-content");
    if (fullScreenInfotext.scrollHeight > document.getElementById("main").clientHeight) {
      makeMarquee(fullScreenInfotext, infotexts.general.join(STRINGS.marqueeJoiner), "vertical");
    }
  }
  else {
    settings.infotextGeneral = false;
  }

  return general === true;
}

function makeMarquee(element, content, direction = "horizontal") {
  // If text overflows, it will be animated
  element.classList.add("marquee");
  element.textContent = "";
  const marqueeContent = document.createElement("div");
  
  marqueeContent.textContent = content;

  /* Assign direction of animation */
  if (direction === "vertical") {
    marqueeContent.classList.add("marqueeContentVertical");
  }
  else {
    marqueeContent.classList.add("marqueeContentHorizontal");
  }

  // The element has to be doubled to animate seamlessly
  element.appendChild(marqueeContent);
  element.appendChild(marqueeContent.cloneNode(true));

  /* The marquee animation is defined by its duration. To make the speed of text indpenendent of
  its length, duration has to be recalculated for every text. */
  if (direction === "vertical") {
    const marqueeDurationVertical = element.scrollHeight / SETTINGS.animationSpeed;
    document.documentElement.style.setProperty("--marquee-duration-vertical", marqueeDurationVertical * 4 + "s");
  }
  else {
    const marqueeDurationHorizontal = marqueeContent.scrollWidth / SETTINGS.animationSpeed;
    document.documentElement.style.setProperty("--marquee-duration-horizontal", marqueeDurationHorizontal + "s");
  }
}

function updateFontSize() {
  // Copy the desired number of rows to CSS
  document.documentElement.style.setProperty("--displayed-rows", parameters.limit);
  const bodyClasses = document.getElementsByTagName("body")[0].classList
  bodyClasses.remove(...bodyClasses);
  bodyClasses.add("fontsize" + parameters.limit);

  // Copy the display width to CSS
  if (parameters.displayWidth !== PARAMETERS.displayWidth) {
    document.documentElement.style.setProperty("--total-width", parameters.displayWidth + "px");
  }
}

// Text to speech
// Convert route numbers with letters to pronounced separate letters
function mixedNumberToWords(inputString) {
  if (inputString.length === 0) {
    return "";
  }

  const letters = { a: "á", b: "bé", c: "cé", č: "čé", d: "dé", ď: "ďé", e: "é", f: "ef", g: "gé", h: "há", i: "í", j: "jé", k: "ká", l: "el", m: "em", n: "en", ň: "eň", o: "ó", p: "pé", q: "kvé", r: "er", ř: "eř", s: "e:s", š: "eš", t: "té", ť: "ťé", u: "ú", v: "vé", w: "dvojité vé", x: "iks", y: "ypsilon", z: "zed", ž: "žed" };
  const separateLettersNumbers = new RegExp(/\p{L}+|\p{N}+/ug);
  let output = [];
  const block = inputString.match(separateLettersNumbers);
  // Short uppercase sequences are read as single letters
  block.forEach((item) => {
    if (/^\p{Lu}{1,2}$/ug.test(item)) {
      item.split("").forEach(
        (letter) => {
          output.push(letters[letter.toLowerCase()]);
        }
      )
    }
    else output.push(digitsToWords(item));
  });

  return output.join(" ");
}

// Convert digits to word strings (works for numbers smaller than 9999)
function digitsToWords(number) {
  if (number.length === 0) return "";
  const quadDigit = new RegExp("[1-9][0-9]{0,3}");
  if (!quadDigit.test(number)) return number;
  number = parseInt(number, 10).toString();
  const basics = ["", "jedna", "dva", "tři", "čtyři", "pět", "šest", "sedm", "osm", "devět", "deset", "jedenáct", "dvanáct", "třináct", "čtrnáct", "patnáct", "šestnáct", "sedmnáct", "osmnáct", "devatenáct"];
  const tens = [, "deset", "dvacet", "třicet", "čtyřicet", "padesát", "šedesát", "sedmdesát", "osmdesát", "devadesát"];
  const hundreds = [, "sto ", "dvěstě ", "třista ", "čtyřista ", "pětset ", "šestset ", "sedmset ", "osmset ", "devětset "];
  if (number === 0) return "nula";
  if (number <= 19) return basics[number];
  if (number <= 99) return tens[number.slice(0, 1)] + basics[number.slice(1)];
  if (number <= 999 && number % 100 === 0) return hundreds[number.slice(0, 1)]; // Handle whole hundreds
  if (number <= 999) return hundreds[number.slice(0, 1)] + digitsToWords(number.slice(1));
  return number;
}

// Numeric keys will trigger reading identically to VPN (remote control for visually impaired)
// Only keys 1,5,6 are handled
document.addEventListener("keydown", function (event) {
  // Reset pause button inactivity timer
  if (settings.inactivityTimer > 0) clearTimeout(settings.inactivityTimer);
  switch (event.key) {
    case "1":
      // Read stop name
      readOutLoud(prepareReadOutHeader(data));
      event.preventDefault();
      break;
    case "5":
      // Pause
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      else if (!window.speechSynthesis.paused && window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
        settings.inactivityTimer = setTimeout(function () { window.speechSynthesis.cancel() }, 10000);
      }
      event.preventDefault();
      break;
    case "6":
      // Read list of departures
      readOutLoud(prepareReadOutDepartures(data));
      event.preventDefault();
      break;
  }
});

// Read header in form Stop Name + platform name. Does not sound well for stops with many platforms
function prepareReadOutHeader(data) {
  let uniquePlatforms = new Set();
  for (const stop of data.stops) {
    uniquePlatforms.add(mixedNumberToWords(stop.platform_code));
  }
  return data.stops[0].stop_name + " stanoviště " + [...uniquePlatforms].join("– a ");
}

function prepareReadOutDepartures(data) {
  // Store the text to be spoken
  let sentences = [];

  // Fallback message when no data is received
  if (!data) {
    sentences.push("Zastávka je nyní bez provozu");
    return sentences;
  }

  // Shortcut if no departures available
  if (data.departures.length === 0) {
    sentences.push("V blízké době není naplánovaný žádný odjezd.");
  }

  // GTFS transport mode translation table
  const transportMode = ["Tramvaj", "Metro", "Vlak", "Autobus", "Přívoz", "Lanovka", "Visutá lanovka", "Lanovka",,,, "Trolejbus"];

  // Prepare infotext
  if (data.infotexts.length > 0) {
    for (const informationText of data.infotexts) {
      // Convert numbers in the text to words
      informationText.text = informationText.text.replace(/(\d+)/g, function (match) {
        return (digitsToWords(match));
      });
      sentences.push(informationText.text);
    }
  }

  // Count the number of spoken rows. In case we receive more lines then are displayed, stop reading
  let counter = 1;

  // Flip through every departure and prepare a sentence
  for (const departure of data.departures) {
    if (counter > parameters.limit) break;
    counter++;
    // Autobus 119 směr Letiště odjede z nástupiště A za 5 minut.
    let prepareSentence;
    const time = departure.departure_timestamp.minutes;
    const platform = (settings.showPlatformNumbers && departure.stop.platform_code !== null) ? "z nástupiště " + mixedNumberToWords(departure.stop.platform_code) : "";

    // Calculate the time to arrival
    // Patch together the sentence
    prepareSentence = `${transportMode[departure.route.type]} ${mixedNumberToWords(departure.route.short_name)} směr ${departure.trip.headsign} odjede ${platform} za `
    if (time == "<1") prepareSentence += "méně než jednu minutu."
    else if (time <= 1) prepareSentence += "jednu minutu."
    else if (time == 2) prepareSentence += "dvě minuty."
    else if (time > 2 && time < 5) prepareSentence += digitsToWords(time) + " minuty."
    else prepareSentence += digitsToWords(time) + " minut.";
    sentences.push(prepareSentence);
  }

  return sentences;
}

// Load sounds
function playChime(file) {
  return new Promise(function (resolve, reject) {
    const sound = new Audio(`${file}.mp3`);
    sound.onerror = reject;
    sound.onended = resolve;
    sound.play();
  });
}

function endRead() {
  playChime("end");
  settings.reading = false;
};

async function readOutLoud(sentences) {
  // Do not read if other reading is in progress
  if (settings.reading && !window.speechSynthesis.paused || window.speechSynthesis.pending) return false;

  // If starting from a paused state, free the speech queue so we can start again
  if (window.speechSynthesis.paused) window.speechSynthesis.cancel();
  settings.reading = true;
  const say = new SpeechSynthesisUtterance(sentences);
  say.lang = "cs-CZ";
  say.rate = SETTINGS.speechSpeed;

  // Speak the texts with intro and outro chimes
  await playChime("start");
  window.speechSynthesis.speak(say);
  say.onend = function () { endRead() };
  say.oncancel = function () { endRead() };

  /* TTS template
   <gong>
   Zastávka <StopName>.
   <VehicleType> <RouteNumber> směr <Destination> přijede za <min> minut.
   <cvak>
   */
}

function updateClock() {
  // Date Úterý 19. 01. 2038
  const now = new Date();
  function padNumber(number) {
    return number.toString().padStart(2, "0");
  }
  const date = STRINGS.dayOfWeek[now.getDay()] +
    "&ensp;" +
    padNumber(now.getDate()) +
    ".&thinsp;" +
    padNumber(now.getMonth() + 1) +
    ".&thinsp;" +
    padNumber(now.getFullYear());

  // Time 03:14
  const hours = padNumber(now.getHours());
  const minutes = padNumber(now.getMinutes());
  document.getElementById("date").innerHTML = date;
  document.getElementById("hours").textContent = hours;
  document.getElementById("minutes").textContent = minutes;
}

// Set fullscreen information text
function fullScreenMessage(content = "") {
  const main = document.getElementsByTagName("main")[0];
  const message = document.getElementById("fullscreen-text").content.cloneNode(true);
  message.firstChild.innerHTML = content;
  main.textContent = "";
  main.appendChild(message);
}

// Add spaces after commas and periods
function prettyPrint(input) {
  if (input === null) return "";
  return input.replace(new RegExp("([.,])(?![., 0-9-]|$)", "g"), "$1 "); // Contains U+200A Hair space
}

// Timer for content updates 20 s
const getDataTimer = setInterval(function () {
  getData(queryString);
}, 20000);


// Timer for clock update 1 s and off-line evaluation
const updateClockTimer = setInterval(function () {
  updateClock();
  settings.offlineCounter++;
  if (settings.offlineCounter > SETTINGS.offlineLimit) {
    fullScreenMessage(STRINGS.offlineText);
  }
}, 1000);
