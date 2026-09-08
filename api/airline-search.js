/**
 * BOKKARA AIRLINE SEARCH API
 * Vercel Serverless Function
 *
 * Endpoint:
 * /api/airline-search?flight=JBU117&date=2026-09-08
 *
 * Environment variable required:
 * SERPAPI_KEY
 *
 * Accepts:
 *   JBU117
 *   JBU 117
 *   B6117
 *   B6 117
 *   JetBlue 117
 */

const SERPAPI_URL = "https://serpapi.com/search.json";
const REQUEST_TIMEOUT_MS = 25000;


/* =========================================================
   CORS
========================================================= */

function setCors(res) {
  res.setHeader(
    "Access-Control-Allow-Origin",
    "*"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );
}


/* =========================================================
   JSON RESPONSE
========================================================= */

function sendJson(res, status, data) {
  return res.status(status).json(data);
}


/* =========================================================
   CLEAN STRING
========================================================= */

function clean(value) {
  if (
    value === undefined ||
    value === null
  ) {
    return "";
  }

  return String(value).trim();
}


/* =========================================================
   NORMALIZE FLIGHT NUMBER
========================================================= */

function normalizeFlight(value) {
  return clean(value)
    .toUpperCase()
    .replace(/[\s-]+/g, "");
}


/* =========================================================
   PARSE FLIGHT NUMBER
========================================================= */

function parseFlightNumber(value) {
  const normalized =
    normalizeFlight(value);

  let match =
    normalized.match(
      /^([A-Z0-9]{2,3})(\d{1,5})$/
    );

  if (match) {
    return {
      original: normalized,
      airlineCode: match[1],
      number: match[2]
    };
  }

  const spaced =
    clean(value)
      .toUpperCase()
      .match(
        /^([A-Z0-9]{2,3})[\s-]+(\d{1,5})$/
      );

  if (spaced) {
    return {
      original: normalized,
      airlineCode: spaced[1],
      number: spaced[2]
    };
  }

  return {
    original: normalized,
    airlineCode: "",
    number: ""
  };
}


/* =========================================================
   ICAO -> IATA
========================================================= */

const ICAO_TO_IATA = {
  JBU: "B6",
  UAL: "UA",
  DAL: "DL",
  AAL: "AA",
  ASA: "AS",
  SWA: "WN",
  FFT: "F9",
  NKS: "NK",
  AAY: "G4",
  UAE: "EK",
  QTR: "QR",
  BAW: "BA",
  AFR: "AF",
  KLM: "KL",
  DLH: "LH",
  THY: "TK",
  ACA: "AC",
  WJA: "WS",
  VOI: "Y4",
  AMX: "AM",
  AZA: "AZ",
  TAP: "TP",
  IBX: "IB",
  IBE: "IB",
  VLG: "VY",
  EIN: "EI",
  ETD: "EY",
  SIA: "SQ",
  CPA: "CX",
  JAL: "JL",
  ANA: "NH",
  KAL: "KE",
  AIC: "AI",
  MAS: "MH",
  QFA: "QF",
  VIR: "VS",
  ELY: "LY",
  SAS: "SK",
  FIN: "AY",
  LOT: "LO",
  SWR: "LX",
  AZU: "AD"
};


/* =========================================================
   AIRLINE NAMES
========================================================= */

const AIRLINE_NAMES = {
  B6: "JetBlue",
  UA: "United Airlines",
  DL: "Delta Air Lines",
  AA: "American Airlines",
  AS: "Alaska Airlines",
  WN: "Southwest Airlines",
  F9: "Frontier Airlines",
  NK: "Spirit Airlines",
  G4: "Allegiant Air",
  EK: "Emirates",
  QR: "Qatar Airways",
  BA: "British Airways",
  AF: "Air France",
  KL: "KLM",
  LH: "Lufthansa",
  TK: "Turkish Airlines",
  AC: "Air Canada",
  WS: "WestJet",
  Y4: "Volaris",
  AM: "Aeromexico",
  AZ: "ITA Airways",
  TP: "TAP Air Portugal",
  IB: "Iberia",
  VY: "Vueling",
  EI: "Aer Lingus",
  EY: "Etihad Airways",
  SQ: "Singapore Airlines",
  CX: "Cathay Pacific",
  JL: "Japan Airlines",
  NH: "ANA",
  KE: "Korean Air",
  AI: "Air India",
  MH: "Malaysia Airlines",
  QF: "Qantas",
  VS: "Virgin Atlantic",
  LY: "EL AL",
  SK: "SAS",
  AY: "Finnair",
  LO: "LOT Polish Airlines",
  LX: "SWISS",
  AD: "Azul"
};


/* =========================================================
   BUILD SEARCHES
========================================================= */

function buildSearches(
  flightInput,
  date
) {
  const parsed =
    parseFlightNumber(
      flightInput
    );

  const original =
    parsed.original;

  const number =
    parsed.number;

  const inputCode =
    parsed.airlineCode;

  const iataCode =
    ICAO_TO_IATA[inputCode] ||
    inputCode;

  const airlineName =
    AIRLINE_NAMES[iataCode] ||
    "";

  const searches = [];

  if (
    iataCode &&
    number
  ) {
    searches.push(
      `${iataCode} ${number} flight status ${date}`
    );
  }

  if (
    iataCode &&
    number
  ) {
    searches.push(
      `${iataCode}${number} flight status ${date}`
    );
  }

  if (
    airlineName &&
    number
  ) {
    searches.push(
      `${airlineName} ${number} flight status ${date}`
    );
  }

  if (original) {
    searches.push(
      `${original} flight status ${date}`
    );
  }

  if (
    inputCode &&
    inputCode !== iataCode &&
    number
  ) {
    searches.push(
      `${inputCode} ${number} flight status ${date}`
    );
  }

  return [
    ...new Set(searches)
  ];
}


/* =========================================================
   FETCH SERPAPI
========================================================= */

async function searchSerpApi(query) {
  const apiKey =
    process.env.SERPAPI_KEY;

  if (!apiKey) {
    throw new Error(
      "SERPAPI_KEY is not configured in Vercel."
    );
  }

  const url =
    new URL(SERPAPI_URL);

  url.searchParams.set(
    "engine",
    "google"
  );

  url.searchParams.set(
    "q",
    query
  );

  url.searchParams.set(
    "api_key",
    apiKey
  );

  url.searchParams.set(
    "hl",
    "en"
  );

  url.searchParams.set(
    "gl",
    "us"
  );

  url.searchParams.set(
    "google_domain",
    "google.com"
  );

  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      REQUEST_TIMEOUT_MS
    );

  try {
    const response =
      await fetch(
        url.toString(),
        {
          method: "GET",
          headers: {
            Accept:
              "application/json"
          },
          signal:
            controller.signal
        }
      );

    const text =
      await response.text();

    let json;

    try {
      json =
        JSON.parse(text);
    } catch {
      throw new Error(
        `SerpApi returned invalid JSON. HTTP ${response.status}`
      );
    }

    if (!response.ok) {
      throw new Error(
        json.error ||
        `SerpApi HTTP ${response.status}`
      );
    }

    if (json.error) {
      throw new Error(
        json.error
      );
    }

    return json;

  } finally {
    clearTimeout(timeout);
  }
}


/* =========================================================
   GET AIRPORT OBJECT
========================================================= */

function getAirportObject(value) {
  if (!value) {
    return {};
  }

  /*
   * Sometimes SerpApi returns
   * an array.
   */

  if (Array.isArray(value)) {
    return value[0] || {};
  }

  /*
   * Some structures wrap the airport.
   */

  if (
    value.airport &&
    typeof value.airport === "object"
  ) {
    return {
      ...value.airport,
      ...value
    };
  }

  return value;
}


/* =========================================================
   NORMALIZE AIRPORT
========================================================= */

function normalizeAirport(value) {
  const airport =
    getAirportObject(value);

  if (!airport) {
    return {
      airport_code: "",
      city: "",
      name: ""
    };
  }

  if (
    typeof airport === "string"
  ) {
    return {
      airport_code:
        airport.trim(),
      city: "",
      name:
        airport.trim()
    };
  }

  return {
    airport_code:
      clean(
        airport.id ||
        airport.code ||
        airport.airport_code ||
        airport.airport_name
      ),

    city:
      clean(
        airport.city ||
        airport.city_name ||
        airport.location
      ),

    name:
      clean(
        airport.name ||
        airport.airport_name
      )
  };
}


/* =========================================================
   GET TIME VALUE
========================================================= */

function getTimeValue(
  airport
) {
  const value =
    getAirportObject(
      airport
    );

  return clean(
    value.time_label ||
    value.time ||
    value.actual_time ||
    value.actualTime ||
    value.estimated_time ||
    value.estimatedTime ||
    value.planned_time ||
    value.scheduled_time ||
    value.scheduledTime ||
    value.datetime ||
    ""
  );
}


/* =========================================================
   GET SCHEDULED TIME
========================================================= */

function getScheduledTime(
  airport
) {
  const value =
    getAirportObject(
      airport
    );

  return clean(
    value.scheduled_time_label ||
    value.scheduled_time ||
    value.scheduledTime ||
    value.planned_time ||
    value.scheduled ||
    ""
  );
}


/* =========================================================
   GET ACTUAL / CURRENT TIME
========================================================= */

function getActualTime(
  airport
) {
  const value =
    getAirportObject(
      airport
    );

  return clean(
    value.time_label ||
    value.time ||
    value.actual_time ||
    value.actualTime ||
    value.estimated_time ||
    value.estimatedTime ||
    ""
  );
}


/* =========================================================
   GET TERMINAL
========================================================= */

function getTerminal(
  airport
) {
  const value =
    getAirportObject(
      airport
    );

  return clean(
    value.terminal ||
    value.terminal_name ||
    value.terminalName ||
    value.terminal_number ||
    value.terminalNumber ||
    ""
  );
}


/* =========================================================
   GET GATE
========================================================= */

function getGate(
  airport
) {
  const value =
    getAirportObject(
      airport
    );

  return clean(
    value.gate ||
    value.gate_name ||
    value.gateName ||
    value.gate_number ||
    value.gateNumber ||
    ""
  );
}


/* =========================================================
   GET DATE
========================================================= */

function getAirportDate(
  airport
) {
  const value =
    getAirportObject(
      airport
    );

  return clean(
    value.date ||
    ""
  );
}


/* =========================================================
   EXTRACT DEPARTURE
========================================================= */

function extractDeparture(
  data
) {
  /*
   * IMPORTANT:
   *
   * SerpApi Flight Result API:
   *
   * selected_date.departure_airport
   *
   * Google Flight Status:
   *
   * departure
   *
   * Support BOTH.
   */

  const departure =
    getAirportObject(
      data?.departure ||
      data?.departure_airport ||
      data?.selected_date?.departure_airport ||
      data?.selectedDate?.departure_airport ||
      {}
    );

  const airport =
    normalizeAirport(
      departure
    );

  return {
    airport_code:
      airport.airport_code,

    city:
      airport.city,

    name:
      airport.name,

    date:
      getAirportDate(
        departure
      ),

    planned_time:
      getScheduledTime(
        departure
      ) ||
      getTimeValue(
        departure
      ),

    actual_time:
      getActualTime(
        departure
      ),

    terminal:
      getTerminal(
        departure
      ),

    gate:
      getGate(
        departure
      )
  };
}


/* =========================================================
   EXTRACT ARRIVAL
========================================================= */

function extractArrival(
  data
) {
  /*
   * Support:
   *
   * data.arrival
   * data.arrival_airport
   * data.selected_date.arrival_airport
   */

  const arrival =
    getAirportObject(
      data?.arrival ||
      data?.arrival_airport ||
      data?.selected_date?.arrival_airport ||
      data?.selectedDate?.arrival_airport ||
      {}
    );

  const airport =
    normalizeAirport(
      arrival
    );

  return {
    airport_code:
      airport.airport_code,

    city:
      airport.city,

    name:
      airport.name,

    date:
      getAirportDate(
        arrival
      ),

    planned_time:
      getScheduledTime(
        arrival
      ) ||
      getTimeValue(
        arrival
      ),

    actual_time:
      getActualTime(
        arrival
      ),

    terminal:
      getTerminal(
        arrival
      ),

    gate:
      getGate(
        arrival
      )
  };
}


/* =========================================================
   FIND ANSWER BOX FLIGHT
========================================================= */

function findAnswerBoxFlight(
  results,
  requestedFlight
) {
  const answerBox =
    results?.answer_box;

  if (!answerBox) {
    return null;
  }

  if (
    answerBox.type !==
    "flight_status"
  ) {
    return null;
  }

  /*
   * Single flight.
   */

  if (
    answerBox.flight_number ||
    answerBox.flight_status ||
    answerBox.departure ||
    answerBox.arrival
  ) {
    return answerBox;
  }

  /*
   * Multiple flights.
   */

  if (
    Array.isArray(
      answerBox.flights
    )
  ) {
    const requested =
      normalizeFlight(
        requestedFlight
      );

    const parsed =
      parseFlightNumber(
        requestedFlight
      );

    /*
     * Try exact IATA match.
     */

    const exact =
      answerBox.flights.find(
        flight => {
          const candidate =
            normalizeFlight(
              flight.flight_number ||
              flight.flight_name ||
              flight.flight_designator ||
              ""
            );

          if (
            candidate ===
            requested
          ) {
            return true;
          }

          /*
           * Also compare numeric
           * flight number.
           */

          const candidateNumber =
            candidate.match(
              /(\d{1,5})$/
            );

          return (
            parsed.number &&
            candidateNumber &&
            candidateNumber[1] ===
              parsed.number
          );
        }
      );

    if (exact) {
      return exact;
    }

    if (
      answerBox.flights.length === 1
    ) {
      return answerBox.flights[0];
    }
  }

  return null;
}


/* =========================================================
   FIND FLIGHT RESULT
========================================================= */

function findFlightResult(
  results
) {
  const flightResult =
    results?.flight_result;

  if (!flightResult) {
    return null;
  }

  if (
    flightResult.flight_designator ||
    flightResult.flight_number ||
    flightResult.route ||
    Array.isArray(
      flightResult.dates
    )
  ) {
    return flightResult;
  }

  return null;
}


/* =========================================================
   EXTRACT FLIGHT RESULT DATE
========================================================= */

function extractFlightFromResult(
  result,
  requestedDate
) {
  if (!result) {
    return null;
  }

  /*
   * SerpApi's Flight Result API
   * stores the detailed flight data
   * inside dates[].
   *
   * Example:
   *
   * dates[
   *   {
   *     date: "2026-09-08",
   *     metadata: {...},
   *     departure_airport: {...},
   *     arrival_airport: {...}
   *   }
   * ]
   */

  if (
    Array.isArray(
      result.dates
    )
  ) {
    const dateMatch =
      result.dates.find(
        item =>
          clean(item?.date) ===
          clean(requestedDate)
      );

    if (dateMatch) {
      return {
        ...result,

        selected_date:
          dateMatch,

        /*
         * IMPORTANT:
         * Promote these to the top
         * level too.
         *
         * This makes the rest of
         * the normalizer compatible
         * with both API formats.
         */

        departure_airport:
          dateMatch.departure_airport ||
          {},

        arrival_airport:
          dateMatch.arrival_airport ||
          {},

        status:
          dateMatch.status ||
          dateMatch.metadata?.status ||
          result.status ||
          "",

        updated_at:
          dateMatch.updated_at ||
          result.updated_at ||
          "",

        updated_label:
          dateMatch.updated_label ||
          result.updated_label ||
          "",

        source:
          dateMatch.source ||
          result.source ||
          "",

        source_url:
          dateMatch.source_url ||
          result.source_url ||
          ""
      };
    }

    /*
     * If requested date was not found
     * but only one date exists, use it.
     */

    if (
      result.dates.length === 1
    ) {
      const dateMatch =
        result.dates[0];

      return {
        ...result,

        selected_date:
          dateMatch,

        departure_airport:
          dateMatch.departure_airport ||
          {},

        arrival_airport:
          dateMatch.arrival_airport ||
          {},

        status:
          dateMatch.status ||
          dateMatch.metadata?.status ||
          result.status ||
          "",

        updated_at:
          dateMatch.updated_at ||
          result.updated_at ||
          "",

        updated_label:
          dateMatch.updated_label ||
          result.updated_label ||
          "",

        source:
          dateMatch.source ||
          result.source ||
          "",

        source_url:
          dateMatch.source_url ||
          result.source_url ||
          ""
      };
    }
  }

  return result;
}


/* =========================================================
   NORMALIZE FLIGHT DATA
========================================================= */

function normalizeFlightData(
  raw,
  requestedFlight,
  requestedDate
) {
  if (!raw) {
    return null;
  }

  const parsed =
    parseFlightNumber(
      requestedFlight
    );

  /*
   * Selected date from
   * SerpApi flight_result.
   */

  const selectedDate =
    raw.selected_date ||
    {};

  const metadata =
    selectedDate.metadata ||
    {};

  /*
   * Flight number.
   */

  let flightNumber =
    clean(
      raw.flight_number ||
      raw.flight_designator ||
      raw.flight_name ||
      raw.title
    );

  /*
   * Airline code.
   */

  let airlineCode =
    clean(
      raw.airline_iata_code ||
      metadata.airline_iata_code ||
      parsed.airlineCode
    );

  /*
   * Flight number digits.
   */

  let numericFlight =
    clean(
      raw.flight_number ||
      metadata.flight_number ||
      parsed.number
    );

  /*
   * Parse flight text if needed.
   */

  const flightText =
    clean(
      raw.flight_designator ||
      raw.flight_number ||
      raw.flight_name ||
      raw.title
    );

  const codeMatch =
    flightText.match(
      /\b([A-Z0-9]{2,3})\s*-?\s*(\d{1,5})\b/i
    );

  if (codeMatch) {
    const detectedCode =
      codeMatch[1].toUpperCase();

    const detectedNumber =
      codeMatch[2];

    if (!airlineCode) {
      airlineCode =
        detectedCode;
    }

    if (!numericFlight) {
      numericFlight =
        detectedNumber;
    }

    if (
      ICAO_TO_IATA[
        detectedCode
      ]
    ) {
      airlineCode =
        ICAO_TO_IATA[
          detectedCode
        ];
    }
  }

  /*
   * Convert ICAO to IATA.
   */

  if (
    ICAO_TO_IATA[
      airlineCode
    ]
  ) {
    airlineCode =
      ICAO_TO_IATA[
        airlineCode
      ];
  }

  /*
   * Airline.
   */

  const airline =
    clean(
      raw.airline ||
      raw.airline_name ||
      AIRLINE_NAMES[
        airlineCode
      ] ||
      ""
    );

  /*
   * =====================================================
   * DEPARTURE / ARRIVAL
   * =====================================================
   *
   * THIS IS THE IMPORTANT FIX.
   *
   * For flight_result:
   *
   * raw.selected_date.departure_airport
   * raw.selected_date.arrival_airport
   *
   * are now read correctly.
   */

  const departure =
    extractDeparture(
      raw
    );

  const arrival =
    extractArrival(
      raw
    );

  /*
   * Fill airport codes from metadata
   * if the airport object didn't contain
   * them.
   */

  if (
    !departure.airport_code &&
    metadata.origin
  ) {
    departure.airport_code =
      clean(
        metadata.origin
      );
  }

  if (
    !arrival.airport_code &&
    metadata.destination
  ) {
    arrival.airport_code =
      clean(
        metadata.destination
      );
  }

  /*
   * Fill cities from route if necessary.
   */

  /*
   * Route.
   */

  let route =
    clean(
      raw.destination ||
      raw.route
    );

  if (!route) {
    const from =
      departure.city ||
      departure.airport_code;

    const to =
      arrival.city ||
      arrival.airport_code;

    if (from || to) {
      route =
        `${from || "—"} to ${to || "—"}`;
    }
  }

  /*
   * Status.
   */

  const status =
    clean(
      raw.flight_status ||
      raw.status ||
      metadata.status ||
      selectedDate.status ||
      ""
    );

  /*
   * Updated text.
   */

  const updatedText =
    clean(
      raw.latest_update ||
      raw.updated_label ||
      raw.updated ||
      raw.update ||
      raw.updated_text ||
      selectedDate.updated_label ||
      raw.updated_at ||
      selectedDate.updated_at ||
      ""
    );

  /*
   * Source.
   */

  let source = "";
  let sourceUrl = "";

  if (
    Array.isArray(
      raw.sources
    ) &&
    raw.sources.length
  ) {
    source =
      clean(
        raw.sources[0]?.name
      );

    sourceUrl =
      clean(
        raw.sources[0]?.link
      );
  }

  /*
   * Flight Result API source.
   */

  if (!source) {
    source =
      clean(
        raw.source ||
        selectedDate.source
      );
  }

  if (!sourceUrl) {
    sourceUrl =
      clean(
        raw.source_url ||
        selectedDate.source_url
      );
  }

  /*
   * Final flight number.
   */

  const finalFlightNumber =
    numericFlight ||
    parsed.number ||
    "";

  /*
   * Designator.
   */

  const designator =
    airlineCode &&
    finalFlightNumber
      ? `${airlineCode} ${finalFlightNumber}`
      : flightNumber;

  /*
   * Title.
   */

  const title =
    clean(
      raw.title ||
      `${airline || ""} ${designator}`
    );

  /*
   * Date.
   */

  const date =
    clean(
      selectedDate.date ||
      requestedDate ||
      raw.date
    );

  /*
   * =====================================================
   * CANONICAL RESPONSE
   * =====================================================
   */

  const canonical = {

    airline:
      airline || "—",

    airline_code:
      airlineCode || "—",

    flight_number:
      finalFlightNumber || "—",

    flight_designator:
      designator || "—",

    title:
      title || "—",

    status:
      status || "—",

    route:
      route || "—",

    date:
      date || "—",

    /*
     * DEPARTURE
     */

    departure: {

      airport_code:
        departure.airport_code ||
        "—",

      city:
        departure.city ||
        "—",

      date:
        departure.date ||
        date ||
        "—",

      /*
       * CURRENT / ACTUAL TIME
       */

      actual_time:
        departure.actual_time ||
        "—",

      /*
       * SCHEDULED TIME
       */

      planned_time:
        departure.planned_time ||
        "—",

      terminal:
        departure.terminal ||
        "—",

      gate:
        departure.gate ||
        "—"
    },

    /*
     * ARRIVAL
     */

    arrival: {

      airport_code:
        arrival.airport_code ||
        "—",

      city:
        arrival.city ||
        "—",

      date:
        arrival.date ||
        date ||
        "—",

      /*
       * CURRENT / ACTUAL TIME
       */

      actual_time:
        arrival.actual_time ||
        "—",

      /*
       * SCHEDULED TIME
       */

      planned_time:
        arrival.planned_time ||
        "—",

      terminal:
        arrival.terminal ||
        "—",

      gate:
        arrival.gate ||
        "—"
    },

    updated_text:
      updatedText ||
      "—",

    source:
      source ||
      "—",

    source_url:
      sourceUrl ||
      "",

    /*
     * =====================================================
     * FRONTEND COMPATIBILITY FIELDS
     * =====================================================
     */

    origin_code:
      departure.airport_code ||
      "—",

    destination_code:
      arrival.airport_code ||
      "—",

    origin_city:
      departure.city ||
      "—",

    destination_city:
      arrival.city ||
      "—",

    departure_time:
      departure.planned_time ||
      "—",

    actual_departure:
      departure.actual_time ||
      "—",

    scheduled_departure:
      departure.planned_time ||
      "—",

    actual_arrival:
      arrival.actual_time ||
      "—",

    scheduled_arrival:
      arrival.planned_time ||
      "—",

    departure_terminal:
      departure.terminal ||
      "—",

    departure_gate:
      departure.gate ||
      "—",

    arrival_terminal:
      arrival.terminal ||
      "—",

    arrival_gate:
      arrival.gate ||
      "—",

    local_time_text:
      updatedText ||
      "—"
  };

  return canonical;
}


/* =========================================================
   SEARCH ONE QUERY
========================================================= */

async function findFlight(
  query,
  requestedFlight,
  requestedDate
) {
  const results =
    await searchSerpApi(
      query
    );

  /*
   * =====================================================
   * 1. GOOGLE FLIGHT STATUS ANSWER BOX
   * =====================================================
   */

  const answerFlight =
    findAnswerBoxFlight(
      results,
      requestedFlight
    );

  if (answerFlight) {

    const normalized =
      normalizeFlightData(
        answerFlight,
        requestedFlight,
        requestedDate
      );

    if (normalized) {
      return {
        data:
          normalized,

        serpapi:
          results,

        method:
          "answer_box"
      };
    }
  }

  /*
   * =====================================================
   * 2. GOOGLE FLIGHT RESULT
   * =====================================================
   */

  const flightResult =
    findFlightResult(
      results
    );

  if (flightResult) {

    /*
     * THIS SELECTS:
     *
     * dates[requestedDate]
     */

    const extracted =
      extractFlightFromResult(
        flightResult,
        requestedDate
      );

    const normalized =
      normalizeFlightData(
        extracted,
        requestedFlight,
        requestedDate
      );

    if (normalized) {
      return {
        data:
          normalized,

        serpapi:
          results,

        method:
          "flight_result"
      };
    }
  }

  return null;
}


/* =========================================================
   MAIN HANDLER
========================================================= */

export default async function handler(
  req,
  res
) {
  setCors(res);

  /*
   * OPTIONS
   */

  if (
    req.method ===
    "OPTIONS"
  ) {
    return res
      .status(204)
      .end();
  }

  /*
   * GET ONLY
   */

  if (
    req.method !==
    "GET"
  ) {
    return sendJson(
      res,
      405,
      {
        success: false,

        error:
          "Method not allowed. Use GET."
      }
    );
  }

  /*
   * INPUT
   */

  const flight =
    clean(
      req.query?.flight
    );

  const date =
    clean(
      req.query?.date
    );

  /*
   * Validate flight.
   */

  if (!flight) {
    return sendJson(
      res,
      400,
      {
        success: false,

        error:
          "Missing flight parameter."
      }
    );
  }

  /*
   * Validate date.
   */

  if (
    !date ||
    !/^\d{4}-\d{2}-\d{2}$/.test(
      date
    )
  ) {
    return sendJson(
      res,
      400,
      {
        success: false,

        error:
          "Invalid date. Use YYYY-MM-DD."
      }
    );
  }

  /*
   * Validate API key.
   */

  if (
    !process.env.SERPAPI_KEY
  ) {
    return sendJson(
      res,
      500,
      {
        success: false,

        error:
          "SERPAPI_KEY is missing from Vercel environment variables."
      }
    );
  }

  /*
   * Parse flight.
   */

  const parsed =
    parseFlightNumber(
      flight
    );

  const normalizedFlight =
    normalizeFlight(
      flight
    );

  /*
   * Search queries.
   */

  const searches =
    buildSearches(
      flight,
      date
    );

  /*
   * Search.
   */

  let found = null;

  const errors = [];

  for (
    const query of searches
  ) {

    try {

      found =
        await findFlight(
          query,
          flight,
          date
        );

      if (found) {
        break;
      }

    } catch (error) {

      errors.push({
        query,

        error:
          error?.message ||
          String(error)
      });
    }
  }

  /*
   * =====================================================
   * SUCCESS
   * =====================================================
   */

  if (
    found?.data
  ) {

    return sendJson(
      res,
      200,
      {
        success: true,

        query: {
          flight,

          normalized_flight:
            normalizedFlight,

          date
        },

        search: {

          airline_input:
            parsed.airlineCode ||
            null,

          airline_iata:
            ICAO_TO_IATA[
              parsed.airlineCode
            ] ||
            parsed.airlineCode ||
            null,

          flight_number:
            parsed.number ||
            null,

          queries_used:
            searches,

          method:
            found.method
        },

        /*
         * Main response.
         */

        flight:
          found.data,

        /*
         * Compatibility.
         */

        flight_result:
          found.data,

        data:
          found.data
      }
    );
  }

  /*
   * =====================================================
   * NO RESULT
   * =====================================================
   */

  return sendJson(
    res,
    200,
    {
      success: false,

      error:
        `No flight status was found for ${formatFlightForDisplay(
          flight
        )} on ${date}.`,

      query: {

        flight,

        normalized_flight:
          normalizedFlight,

        date
      },

      search: {

        airline_input:
          parsed.airlineCode ||
          null,

        airline_iata:
          ICAO_TO_IATA[
            parsed.airlineCode
          ] ||
          parsed.airlineCode ||
          null,

        flight_number:
          parsed.number ||
          null,

        queries_used:
          searches
      },

      search_errors:
        errors
    }
  );
}


/* =========================================================
   DISPLAY FLIGHT
========================================================= */

function formatFlightForDisplay(
  value
) {
  const parsed =
    parseFlightNumber(
      value
    );

  const code =
    ICAO_TO_IATA[
      parsed.airlineCode
    ] ||
    parsed.airlineCode;

  if (
    code &&
    parsed.number
  ) {
    return `${code} ${parsed.number}`;
  }

  return clean(value);
}
