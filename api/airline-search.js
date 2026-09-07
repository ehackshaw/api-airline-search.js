/**
 * ============================================================
 * BOKKARA AIRLINE SEARCH API
 * ============================================================
 *
 * Endpoint:
 *
 * GET /api/airline-search?flight=BW601
 *
 * Flow:
 *
 * Shopify
 *    ↓
 * Bokkara API
 *    ↓
 * SerpApi Google Search
 *    ↓
 * Google Flight Status
 *    ↓
 * Robust extraction / normalization
 *    ↓
 * Bokkara flight object
 *
 * ============================================================
 */

const SERPAPI_URL = "https://serpapi.com/search";


// ============================================================
// CORS
// ============================================================

function setCors(res, origin) {

  const allowedOrigins = [
    "https://bokkara.com",
    "https://www.bokkara.com",
    "https://bokkara.myshopify.com"
  ];

  if (
    origin &&
    allowedOrigins.includes(origin)
  ) {
    res.setHeader(
      "Access-Control-Allow-Origin",
      origin
    );
  } else {
    res.setHeader(
      "Access-Control-Allow-Origin",
      "*"
    );
  }

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  res.setHeader(
    "Access-Control-Max-Age",
    "86400"
  );

  res.setHeader(
    "Vary",
    "Origin"
  );
}


// ============================================================
// BASIC HELPERS
// ============================================================

function isObject(value) {

  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );

}


function isArray(value) {

  return Array.isArray(value);

}


function cleanString(value) {

  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  if (
    typeof value === "string"
  ) {

    const result =
      value
        .replace(/\s+/g, " ")
        .trim();

    return result || null;

  }

  if (
    typeof value === "number" ||
    typeof value === "boolean"
  ) {

    return String(value);

  }

  return null;

}


function firstString(...values) {

  for (const value of values) {

    const result =
      cleanString(value);

    if (result) {
      return result;
    }

  }

  return null;

}


function firstNumber(...values) {

  for (const value of values) {

    if (
      typeof value === "number" &&
      Number.isFinite(value)
    ) {
      return value;
    }

    if (
      typeof value === "string" &&
      value.trim() !== ""
    ) {

      const number =
        Number(
          value
            .replace("%", "")
            .trim()
        );

      if (
        Number.isFinite(number)
      ) {
        return number;
      }

    }

  }

  return null;

}


function normalizeFlightNumber(value) {

  const text =
    cleanString(value);

  if (!text) {
    return null;
  }

  return text
    .replace(/[\s-]+/g, "")
    .toUpperCase();

}


// ============================================================
// RECURSIVE OBJECT WALK
// ============================================================

function collectObjects(
  value,
  results = [],
  depth = 0
) {

  if (
    value === null ||
    value === undefined
  ) {
    return results;
  }

  if (
    depth > 20
  ) {
    return results;
  }

  if (Array.isArray(value)) {

    for (const item of value) {

      collectObjects(
        item,
        results,
        depth + 1
      );

    }

    return results;
  }

  if (!isObject(value)) {
    return results;
  }

  results.push(value);

  for (
    const child of Object.values(value)
  ) {

    if (
      child &&
      typeof child === "object"
    ) {

      collectObjects(
        child,
        results,
        depth + 1
      );

    }

  }

  return results;

}


function findValuesDeep(
  object,
  keys,
  results = [],
  depth = 0
) {

  if (
    object === null ||
    object === undefined ||
    depth > 20
  ) {
    return results;
  }

  if (Array.isArray(object)) {

    for (const item of object) {

      findValuesDeep(
        item,
        keys,
        results,
        depth + 1
      );

    }

    return results;
  }

  if (!isObject(object)) {
    return results;
  }

  const wanted =
    keys.map(
      key =>
        String(key).toLowerCase()
    );

  for (
    const [key, value]
    of Object.entries(object)
  ) {

    const normalizedKey =
      key.toLowerCase();

    if (
      wanted.includes(
        normalizedKey
      )
    ) {

      results.push(value);

    }

    if (
      value &&
      typeof value === "object"
    ) {

      findValuesDeep(
        value,
        keys,
        results,
        depth + 1
      );

    }

  }

  return results;

}


function findFirstValueDeep(
  object,
  keys
) {

  const values =
    findValuesDeep(
      object,
      keys
    );

  for (
    const value of values
  ) {

    if (
      value !== null &&
      value !== undefined &&
      value !== ""
    ) {

      return value;

    }

  }

  return null;

}


// ============================================================
// PATH READER
// ============================================================

function getPath(
  object,
  path
) {

  const parts =
    path.split(".");

  let current =
    object;

  for (
    const part of parts
  ) {

    if (
      current === null ||
      current === undefined
    ) {
      return null;
    }

    if (
      !Object.prototype.hasOwnProperty.call(
        Object(current),
        part
      )
    ) {
      return null;
    }

    current =
      current[part];

  }

  return current;

}


function firstPath(
  object,
  paths
) {

  for (
    const path of paths
  ) {

    const value =
      getPath(
        object,
        path
      );

    if (
      value !== null &&
      value !== undefined &&
      value !== ""
    ) {

      return value;

    }

  }

  return null;

}


// ============================================================
// AIRPORT PARSER
// ============================================================

function parseAirport(value) {

  const empty = {
    code: null,
    name: null,
    city: null,
    country: null,
    display: null
  };


  if (!value) {
    return empty;
  }


  if (typeof value === "string") {

    const text =
      value
        .replace(/\s+/g, " ")
        .trim();

    if (!text) {
      return empty;
    }


    let code = null;
    let name = text;
    let city = null;
    let country = null;


    // --------------------------------------------------------
    // Piarco International Airport (POS)
    // --------------------------------------------------------

    let match =
      text.match(
        /\(([A-Z]{3})\)/
      );

    if (match) {

      code =
        match[1];

      name =
        text
          .replace(
            /\s*\([A-Z]{3}\)\s*/g,
            ""
          )
          .trim();

    }


    // --------------------------------------------------------
    // POS - Piarco International Airport
    // --------------------------------------------------------

    if (!code) {

      match =
        text.match(
          /^([A-Z]{3})\s*[-–—:]\s*(.+)$/i
        );

      if (match) {

        code =
          match[1].toUpperCase();

        name =
          match[2].trim();

      }

    }


    // --------------------------------------------------------
    // Piarco International Airport - POS
    // --------------------------------------------------------

    if (!code) {

      match =
        text.match(
          /^(.+?)\s*[-–—:]\s*([A-Z]{3})$/i
        );

      if (match) {

        name =
          match[1].trim();

        code =
          match[2].toUpperCase();

      }

    }


    // --------------------------------------------------------
    // POS
    // --------------------------------------------------------

    if (
      !code &&
      /^[A-Z]{3}$/i.test(text)
    ) {

      code =
        text.toUpperCase();

      name = null;

    }


    return {
      code,
      name,
      city,
      country,
      display: text
    };

  }


  if (!isObject(value)) {
    return empty;
  }


  const nestedAirport =
    value.airport &&
    typeof value.airport === "object"
      ? value.airport
      : null;


  const source =
    nestedAirport ||
    value;


  const code =
    firstString(
      source.iata,
      source.iata_code,
      source.iataCode,
      source.airport_code,
      source.airportCode,
      source.code
    );


  const name =
    firstString(
      source.name,
      source.airport_name,
      source.airportName,
      source.title,
      source.label
    );


  const city =
    firstString(
      source.city,
      source.city_name,
      source.cityName,
      source.location,
      source.municipality
    );


  const country =
    firstString(
      source.country,
      source.country_name,
      source.countryName
    );


  return {
    code:
      code
        ? code.toUpperCase()
        : null,

    name,

    city,

    country,

    display:
      firstString(
        name,
        city,
        code
      )
  };

}


// ============================================================
// AIRPORT EXTRACTION
// ============================================================

function extractAirportFromObject(
  object,
  type
) {

  if (!object) {
    return {
      code: null,
      name: null,
      city: null,
      country: null,
      display: null
    };
  }


  const isDeparture =
    type === "departure";


  const paths =
    isDeparture
      ? [
          "airport",
          "departure_airport",
          "origin_airport",
          "origin",
          "from",
          "departure"
        ]
      : [
          "airport",
          "arrival_airport",
          "destination_airport",
          "destination",
          "to",
          "arrival"
        ];


  for (
    const path of paths
  ) {

    const value =
      getPath(
        object,
        path
      );

    if (
      value &&
      typeof value === "object"
    ) {

      const airport =
        parseAirport(value);

      if (
        airport.code ||
        airport.name ||
        airport.city
      ) {

        return airport;

      }

    }

  }


  const code =
    firstString(
      isDeparture
        ? object.departure_airport_code
        : object.arrival_airport_code,

      isDeparture
        ? object.origin_code
        : object.destination_code,

      isDeparture
        ? object.origin_iata
        : object.destination_iata,

      isDeparture
        ? object.departure_iata
        : object.arrival_iata
    );


  const name =
    firstString(
      isDeparture
        ? object.departure_airport_name
        : object.arrival_airport_name,

      isDeparture
        ? object.origin_name
        : object.destination_name
    );


  const city =
    firstString(
      isDeparture
        ? object.departure_city
        : object.arrival_city,

      isDeparture
        ? object.origin_city
        : object.destination_city
    );


  const country =
    firstString(
      isDeparture
        ? object.departure_country
        : object.arrival_country
    );


  if (
    code ||
    name ||
    city
  ) {

    return {
      code:
        code
          ? code.toUpperCase()
          : null,

      name,

      city,

      country,

      display:
        firstString(
          name,
          city,
          code
        )
    };

  }


  return {
    code: null,
    name: null,
    city: null,
    country: null,
    display: null
  };

}


// ============================================================
// TIME NORMALIZATION
// ============================================================

function normalizeTime(
  value
) {

  const empty = {
    scheduled: null,
    estimated: null,
    actual: null,
    timezone: null
  };


  if (!value) {
    return empty;
  }


  if (typeof value === "string") {

    return {
      scheduled: value.trim() || null,
      estimated: null,
      actual: null,
      timezone: null
    };

  }


  if (!isObject(value)) {
    return empty;
  }


  return {

    scheduled:
      firstString(
        value.scheduled,
        value.scheduled_time,
        value.scheduledTime,
        value.departure_time,
        value.arrival_time,
        value.time,
        value.local_time
      ),

    estimated:
      firstString(
        value.estimated,
        value.estimated_time,
        value.estimatedTime,
        value.expected,
        value.expected_time
      ),

    actual:
      firstString(
        value.actual,
        value.actual_time,
        value.actualTime
      ),

    timezone:
      firstString(
        value.timezone,
        value.time_zone,
        value.tz
      )

  };

}


// ============================================================
// TIME EXTRACTION
// ============================================================

function extractTime(
  object,
  type
) {

  const departure =
    type === "departure";


  const paths =
    departure
      ? [
          "time",
          "times",
          "departure_time",
          "departureTime",
          "scheduled_time",
          "scheduled",
          "departure"
        ]
      : [
          "time",
          "times",
          "arrival_time",
          "arrivalTime",
          "scheduled_time",
          "scheduled",
          "arrival"
        ];


  for (
    const path of paths
  ) {

    const value =
      getPath(
        object,
        path
      );

    if (
      value &&
      (
        typeof value === "string" ||
        typeof value === "object"
      )
    ) {

      const result =
        normalizeTime(value);

      if (
        result.scheduled ||
        result.estimated ||
        result.actual
      ) {

        return result;

      }

    }

  }


  const prefix =
    departure
      ? "departure"
      : "arrival";


  return {

    scheduled:
      firstString(
        object[
          `${prefix}_scheduled`
        ],

        object[
          `${prefix}_scheduled_time`
        ],

        object[
          `${prefix}_time`
        ],

        object[
          `${prefix}Time`
        ]
      ),

    estimated:
      firstString(
        object[
          `${prefix}_estimated`
        ],

        object[
          `${prefix}_estimated_time`
        ]
      ),

    actual:
      firstString(
        object[
          `${prefix}_actual`
        ],

        object[
          `${prefix}_actual_time`
        ]
      ),

    timezone:
      firstString(
        object.timezone,
        object.time_zone
      )

  };

}


// ============================================================
// AIRLINE
// ============================================================

function normalizeAirline(
  value
) {

  if (!value) {

    return {
      name: null,
      code: null,
      logo: null
    };

  }


  if (
    typeof value === "string"
  ) {

    return {
      name: value.trim(),
      code: null,
      logo: null
    };

  }


  if (!isObject(value)) {

    return {
      name: null,
      code: null,
      logo: null
    };

  }


  return {

    name:
      firstString(
        value.name,
        value.airline,
        value.title,
        value.operator,
        value.carrier
      ),

    code:
      firstString(
        value.iata,
        value.iata_code,
        value.iataCode,
        value.code,
        value.airline_code,
        value.airline_iata_code
      ),

    logo:
      firstString(
        value.logo,
        value.logo_url,
        value.logoUrl,
        value.image,
        value.image_url,
        value.imageUrl,
        value.thumbnail,
        value.icon
      )

  };

}


// ============================================================
// AIRLINE EXTRACTION
// ============================================================

function extractAirline(
  object,
  data
) {

  const candidates = [

    object.airline,

    object.carrier,

    object.operating_airline,

    object.marketing_airline,

    object.airline_info,

    object.carrier_info,

    findFirstValueDeep(
      data,
      [
        "airline"
      ]
    ),

    findFirstValueDeep(
      data,
      [
        "carrier"
      ]
    )

  ];


  for (
    const candidate of candidates
  ) {

    const airline =
      normalizeAirline(
        candidate
      );

    if (
      airline.name ||
      airline.code ||
      airline.logo
    ) {

      return airline;

    }

  }


  return {
    name: null,
    code: null,
    logo: null
  };

}


// ============================================================
// AIRCRAFT
// ============================================================

function normalizeAircraft(
  value
) {

  if (!value) {

    return {
      name: null,
      type: null,
      model: null,
      registration: null,
      code: null
    };

  }


  if (
    typeof value === "string"
  ) {

    return {
      name: value.trim(),
      type: null,
      model: null,
      registration: null,
      code: null
    };

  }


  if (!isObject(value)) {

    return {
      name: null,
      type: null,
      model: null,
      registration: null,
      code: null
    };

  }


  return {

    name:
      firstString(
        value.name,
        value.model,
        value.type,
        value.aircraft,
        value.aircraft_name
      ),

    type:
      firstString(
        value.type,
        value.aircraft_type,
        value.aircraftType
      ),

    model:
      firstString(
        value.model,
        value.model_name,
        value.modelName
      ),

    registration:
      firstString(
        value.registration,
        value.registration_number,
        value.registrationNumber,
        value.tail_number,
        value.tailNumber
      ),

    code:
      firstString(
        value.code,
        value.aircraft_code,
        value.aircraftCode
      )

  };

}


function extractAircraft(
  object,
  data
) {

  const candidates = [

    object.aircraft,

    object.aircraft_info,

    object.plane,

    object.equipment,

    findFirstValueDeep(
      data,
      [
        "aircraft"
      ]
    ),

    findFirstValueDeep(
      data,
      [
        "plane"
      ]
    )

  ];


  for (
    const candidate of candidates
  ) {

    const aircraft =
      normalizeAircraft(
        candidate
      );

    if (
      aircraft.name ||
      aircraft.type ||
      aircraft.model ||
      aircraft.registration
    ) {

      return aircraft;

    }

  }


  return normalizeAircraft(
    null
  );

}


// ============================================================
// TERMINAL / GATE
// ============================================================

function extractTerminal(
  object,
  type
) {

  const departure =
    type === "departure";


  return firstString(

    departure
      ? object.departure_terminal
      : object.arrival_terminal,

    departure
      ? object.departureTerminal
      : object.arrivalTerminal,

    departure
      ? object.origin_terminal
      : object.destination_terminal,

    departure
      ? object.originTerminal
      : object.destinationTerminal,

    object.terminal,

    object.terminal_name,

    object.terminalName

  );

}


function extractGate(
  object,
  type
) {

  const departure =
    type === "departure";


  return firstString(

    departure
      ? object.departure_gate
      : object.arrival_gate,

    departure
      ? object.departureGate
      : object.arrivalGate,

    departure
      ? object.origin_gate
      : object.destination_gate,

    departure
      ? object.originGate
      : object.destinationGate,

    object.gate,
    object.gate_name,
    object.gateName

  );

}


// ============================================================
// STATUS
// ============================================================

function normalizeStatus(
  value
) {

  if (!value) {

    return {
      value: null,
      description: null,
      delay: null,
      code: null
    };

  }


  if (
    typeof value === "string"
  ) {

    return {

      value:
        value.trim(),

      description:
        value.trim(),

      delay:
        null,

      code:
        null

    };

  }


  if (!isObject(value)) {

    return {
      value: null,
      description: null,
      delay: null,
      code: null
    };

  }


  return {

    value:
      firstString(
        value.value,
        value.status,
        value.name,
        value.title,
        value.text,
        value.label
      ),

    description:
      firstString(
        value.description,
        value.status_description,
        value.statusDescription,
        value.detail,
        value.details,
        value.message,
        value.text
      ),

    delay:
      firstString(
        value.delay,
        value.delay_text,
        value.delayText
      ),

    code:
      firstString(
        value.code,
        value.status_code,
        value.statusCode
      )

  };

}


function extractStatus(
  object,
  data
) {

  const candidates = [

    object.status,

    object.flight_status,

    object.flightStatus,

    object.status_info,

    object.statusInfo,

    findFirstValueDeep(
      data,
      [
        "status"
      ]
    ),

    findFirstValueDeep(
      data,
      [
        "flight_status"
      ]
    )

  ];


  for (
    const candidate of candidates
  ) {

    const status =
      normalizeStatus(
        candidate
      );

    if (
      status.value ||
      status.description
    ) {

      return status;

    }

  }


  return normalizeStatus(
    null
  );

}


// ============================================================
// FLIGHT NUMBER
// ============================================================

function extractFlightNumber(
  object,
  data,
  requestedFlight
) {

  const value =
    firstString(

      object.flight_number,

      object.flightNumber,

      object.flight,

      object.number,

      object.flight_num,

      object.flightNumberText,

      findFirstValueDeep(
        data,
        [
          "flight_number",
          "flightNumber"
        ]
      )

    );


  return normalizeFlightNumber(
    value ||
    requestedFlight
  );

}


// ============================================================
// DATE
// ============================================================

function looksLikeDate(
  value
) {

  const text =
    cleanString(value);

  if (!text) {
    return false;
  }


  return (
    /^\d{4}-\d{2}-\d{2}/.test(text) ||
    /^\d{2}\/\d{2}\/\d{4}/.test(text) ||
    /^\d{1,2}\/\d{1,2}\/\d{4}/.test(text) ||
    /[A-Za-z]{3,9}\s+\d{1,2}/.test(text)
  );

}


function extractDate(
  object,
  data,
  departureTime
) {

  const direct =
    firstString(

      object.date,

      object.flight_date,

      object.flightDate,

      object.departure_date,

      object.departureDate,

      object.travel_date,

      object.travelDate

    );


  if (
    direct &&
    looksLikeDate(direct)
  ) {

    return direct;

  }


  const candidates =
    findValuesDeep(
      data,
      [
        "date",
        "flight_date",
        "flightDate",
        "departure_date",
        "departureDate"
      ]
    );


  for (
    const candidate of candidates
  ) {

    const value =
      cleanString(candidate);

    if (
      value &&
      looksLikeDate(value)
    ) {

      return value;

    }

  }


  if (
    departureTime &&
    typeof departureTime === "object"
  ) {

    const scheduled =
      firstString(
        departureTime.scheduled,
        departureTime.estimated,
        departureTime.actual
      );

    if (
      scheduled &&
      looksLikeDate(scheduled)
    ) {

      return scheduled;

    }

  }


  return null;

}


// ============================================================
// DURATION
// ============================================================

function extractDuration(
  object,
  data
) {

  return firstString(

    object.duration,

    object.flight_duration,

    object.flightDuration,

    object.duration_text,

    object.durationText,

    findFirstValueDeep(
      data,
      [
        "duration",
        "flight_duration",
        "flightDuration"
      ]
    )

  );

}


// ============================================================
// BAGGAGE
// ============================================================

function extractBaggage(
  object,
  data
) {

  const value =
    firstPath(
      object,
      [
        "baggage",
        "baggage_allowance",
        "baggageAllowance",
        "checked_baggage",
        "checkedBaggage",
        "carry_on",
        "carryOn"
      ]
    );


  if (
    typeof value === "string"
  ) {
    return value;
  }


  if (
    isObject(value)
  ) {

    return firstString(

      value.description,

      value.text,

      value.label,

      value.allowance,

      value.quantity,

      value.weight

    );

  }


  return firstString(
    findFirstValueDeep(
      data,
      [
        "baggage"
      ]
    )
  );

}


// ============================================================
// PROGRESS
// ============================================================

function extractProgress(
  object,
  data
) {

  const percentage =
    firstNumber(

      object.progress,

      object.progress_percentage,

      object.progressPercentage,

      object.percent_complete,

      object.percentComplete,

      findFirstValueDeep(
        data,
        [
          "progress_percentage",
          "progressPercentage"
        ]
      )

    );


  const text =
    firstString(

      object.progress_text,

      object.progressText,

      object.progress_description,

      findFirstValueDeep(
        data,
        [
          "progress_text",
          "progressText"
        ]
      )

    );


  return {

    percentage,

    text

  };

}


// ============================================================
// LAST UPDATED
// ============================================================

function extractUpdated(
  object,
  data
) {

  return firstString(

    object.last_updated,

    object.lastUpdated,

    object.updated_at,

    object.updatedAt,

    object.last_update,

    object.lastUpdate,

    object.timestamp,

    findFirstValueDeep(
      data,
      [
        "last_updated",
        "lastUpdated",
        "updated_at",
        "updatedAt"
      ]
    )

  );

}


// ============================================================
// FIND FLIGHT CANDIDATES
// ============================================================

function scoreFlightObject(
  object,
  requestedFlight
) {

  if (!isObject(object)) {
    return -Infinity;
  }


  const requested =
    normalizeFlightNumber(
      requestedFlight
    );


  let score = 0;


  const flightValues = [

    object.flight_number,

    object.flightNumber,

    object.flight,

    object.number,

    object.flight_num

  ];


  for (
    const value of flightValues
  ) {

    const normalized =
      normalizeFlightNumber(
        value
      );

    if (
      normalized &&
      requested &&
      normalized === requested
    ) {

      score += 1000;

    }
    else if (
      normalized &&
      requested &&
      normalized.includes(requested)
    ) {

      score += 500;

    }

  }


  const keys =
    Object.keys(object)
      .map(
        key =>
          key.toLowerCase()
      );


  const importantGroups = [

    [
      "departure",
      "origin"
    ],

    [
      "arrival",
      "destination"
    ],

    [
      "airline",
      "carrier"
    ],

    [
      "status",
      "flight_status"
    ],

    [
      "aircraft"
    ],

    [
      "terminal"
    ],

    [
      "gate"
    ],

    [
      "duration"
    ]

  ];


  for (
    const group of importantGroups
  ) {

    if (
      group.some(
        key =>
          keys.includes(key)
      )
    ) {

      score += 20;

    }

  }


  if (
    object.answer_box
  ) {

    score += 10;

  }


  if (
    object.type === "flight"
  ) {

    score += 100;

  }


  return score;

}


function findBestFlightObject(
  data,
  requestedFlight
) {

  const objects =
    collectObjects(
      data
    );


  let best = null;
  let bestScore = -Infinity;


  for (
    const object of objects
  ) {

    const score =
      scoreFlightObject(
        object,
        requestedFlight
      );


    if (
      score > bestScore
    ) {

      bestScore =
        score;

      best =
        object;

    }

  }


  return best;

}


// ============================================================
// FIND STRONGER FLIGHT OBJECTS
// ============================================================

function findFlightCandidates(
  data,
  requestedFlight
) {

  const objects =
    collectObjects(
      data
    );


  const matches =
    objects
      .map(
        object => ({
          object,

          score:
            scoreFlightObject(
              object,
              requestedFlight
            )
        })
      )
      .filter(
        item =>
          item.score >
          -Infinity
      )
      .sort(
        (a,b) =>
          b.score -
          a.score
      );


  return matches;

}


// ============================================================
// MERGE NON-EMPTY VALUES
// ============================================================

function mergeObject(
  target,
  source
) {

  if (
    !source ||
    !isObject(source)
  ) {
    return target;
  }


  for (
    const [key, value]
    of Object.entries(source)
  ) {

    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      continue;
    }


    if (
      isObject(value)
    ) {

      if (
        !isObject(target[key])
      ) {

        target[key] = {};

      }

      mergeObject(
        target[key],
        value
      );

    }
    else {

      if (
        !target[key]
      ) {

        target[key] =
          value;

      }

    }

  }


  return target;

}


// ============================================================
// NORMALIZE ONE FLIGHT
// ============================================================

function normalizeFlight(
  object,
  data,
  requestedFlight
) {

  if (!object) {
    object = {};
  }


  const flightNumber =
    extractFlightNumber(
      object,
      data,
      requestedFlight
    );


  const airline =
    extractAirline(
      object,
      data
    );


  const departureSource =
    firstPath(
      object,
      [
        "departure",
        "origin",
        "from"
      ]
    );


  const arrivalSource =
    firstPath(
      object,
      [
        "arrival",
        "destination",
        "to"
      ]
    );


  const departureObject =
    isObject(departureSource)
      ? departureSource
      : object;


  const arrivalObject =
    isObject(arrivalSource)
      ? arrivalSource
      : object;


  const departureAirport =
    extractAirportFromObject(
      departureObject,
      "departure"
    );


  const arrivalAirport =
    extractAirportFromObject(
      arrivalObject,
      "arrival"
    );


  const departureTime =
    extractTime(
      departureObject,
      "departure"
    );


  const arrivalTime =
    extractTime(
      arrivalObject,
      "arrival"
    );


  const status =
    extractStatus(
      object,
      data
    );


  const aircraft =
    extractAircraft(
      object,
      data
    );


  const duration =
    extractDuration(
      object,
      data
    );


  const progress =
    extractProgress(
      object,
      data
    );


  const baggage =
    extractBaggage(
      object,
      data
    );


  const date =
    extractDate(
      object,
      data,
      departureTime
    );


  const departureTerminal =
    extractTerminal(
      departureObject,
      "departure"
    );


  const departureGate =
    extractGate(
      departureObject,
      "departure"
    );


  const arrivalTerminal =
    extractTerminal(
      arrivalObject,
      "arrival"
    );


  const arrivalGate =
    extractGate(
      arrivalObject,
      "arrival"
    );


  const updated =
    extractUpdated(
      object,
      data
    );


  return {

    number:
      flightNumber,

    requested_flight:
      requestedFlight,

    airline: {

      name:
        airline.name,

      code:
        airline.code,

      logo:
        airline.logo

    },

    status: {

      value:
        status.value,

      code:
        status.code,

      description:
        status.description,

      delay:
        status.delay

    },

    date,

    departure: {

      airport:
        departureAirport,

      time:
        departureTime,

      terminal:
        departureTerminal,

      gate:
        departureGate

    },

    arrival: {

      airport:
        arrivalAirport,

      time:
        arrivalTime,

      terminal:
        arrivalTerminal,

      gate:
        arrivalGate,

      baggage

    },

    aircraft,

    duration,

    progress,

    updated_at:
      updated

  };

}


// ============================================================
// SCORE NORMALIZED FLIGHT
// ============================================================

function scoreNormalizedFlight(
  flight
) {

  let score = 0;


  if (
    flight.number
  ) {
    score += 100;
  }


  if (
    flight.airline?.name
  ) {
    score += 50;
  }


  if (
    flight.airline?.code
  ) {
    score += 25;
  }


  if (
    flight.status?.value
  ) {
    score += 75;
  }


  if (
    flight.departure?.airport?.code
  ) {
    score += 80;
  }


  if (
    flight.arrival?.airport?.code
  ) {
    score += 80;
  }


  if (
    flight.departure?.time?.scheduled ||
    flight.departure?.time?.estimated ||
    flight.departure?.time?.actual
  ) {
    score += 40;
  }


  if (
    flight.arrival?.time?.scheduled ||
    flight.arrival?.time?.estimated ||
    flight.arrival?.time?.actual
  ) {
    score += 40;
  }


  if (
    flight.aircraft?.name
  ) {
    score += 20;
  }


  if (
    flight.duration
  ) {
    score += 15;
  }


  if (
    flight.departure?.terminal
  ) {
    score += 10;
  }


  if (
    flight.departure?.gate
  ) {
    score += 10;
  }


  if (
    flight.arrival?.terminal
  ) {
    score += 10;
  }


  if (
    flight.arrival?.gate
  ) {
    score += 10;
  }


  return score;

}


// ============================================================
// MASTER NORMALIZER
// ============================================================

function normalizeFlightData(
  serpData,
  requestedFlight
) {

  const candidates =
    findFlightCandidates(
      serpData,
      requestedFlight
    );


  const normalizedCandidates = [];


  // ----------------------------------------------------------
  // Normalize top candidates
  // ----------------------------------------------------------

  for (
    const item of candidates.slice(0, 20)
  ) {

    const normalized =
      normalizeFlight(
        item.object,
        serpData,
        requestedFlight
      );


    const score =
      scoreNormalizedFlight(
        normalized
      );


    normalizedCandidates.push({
      normalized,
      score
    });

  }


  // ----------------------------------------------------------
  // Best candidate
  // ----------------------------------------------------------

  normalizedCandidates.sort(
    (a,b) =>
      b.score -
      a.score
  );


  const best =
    normalizedCandidates[0]?.normalized ||
    normalizeFlight(
      findBestFlightObject(
        serpData,
        requestedFlight
      ),
      serpData,
      requestedFlight
    );


  // ----------------------------------------------------------
  // Merge information from strong candidates
  // ----------------------------------------------------------

  for (
    const item
    of normalizedCandidates.slice(1, 10)
  ) {

    const candidate =
      item.normalized;


    if (
      !best.airline.name &&
      candidate.airline.name
    ) {

      best.airline.name =
        candidate.airline.name;

    }


    if (
      !best.airline.code &&
      candidate.airline.code
    ) {

      best.airline.code =
        candidate.airline.code;

    }


    if (
      !best.airline.logo &&
      candidate.airline.logo
    ) {

      best.airline.logo =
        candidate.airline.logo;

    }


    if (
      !best.status.value &&
      candidate.status.value
    ) {

      best.status =
        candidate.status;

    }


    if (
      !best.date &&
      candidate.date
    ) {

      best.date =
        candidate.date;

    }


    if (
      !best.departure.airport.code &&
      candidate.departure.airport.code
    ) {

      best.departure.airport =
        candidate.departure.airport;

    }


    if (
      !best.departure.time.scheduled &&
      candidate.departure.time.scheduled
    ) {

      best.departure.time =
        candidate.departure.time;

    }


    if (
      !best.departure.terminal &&
      candidate.departure.terminal
    ) {

      best.departure.terminal =
        candidate.departure.terminal;

    }


    if (
      !best.departure.gate &&
      candidate.departure.gate
    ) {

      best.departure.gate =
        candidate.departure.gate;

    }


    if (
      !best.arrival.airport.code &&
      candidate.arrival.airport.code
    ) {

      best.arrival.airport =
        candidate.arrival.airport;

    }


    if (
      !best.arrival.time.scheduled &&
      candidate.arrival.time.scheduled
    ) {

      best.arrival.time =
        candidate.arrival.time;

    }


    if (
      !best.arrival.terminal &&
      candidate.arrival.terminal
    ) {

      best.arrival.terminal =
        candidate.arrival.terminal;

    }


    if (
      !best.arrival.gate &&
      candidate.arrival.gate
    ) {

      best.arrival.gate =
        candidate.arrival.gate;

    }


    if (
      !best.arrival.baggage &&
      candidate.arrival.baggage
    ) {

      best.arrival.baggage =
        candidate.arrival.baggage;

    }


    if (
      !best.aircraft.name &&
      candidate.aircraft.name
    ) {

      best.aircraft =
        candidate.aircraft;

    }


    if (
      !best.duration &&
      candidate.duration
    ) {

      best.duration =
        candidate.duration;

    }


    if (
      !best.progress.percentage &&
      candidate.progress.percentage !== null
    ) {

      best.progress.percentage =
        candidate.progress.percentage;

    }


    if (
      !best.progress.text &&
      candidate.progress.text
    ) {

      best.progress.text =
        candidate.progress.text;

    }


    if (
      !best.updated_at &&
      candidate.updated_at
    ) {

      best.updated_at =
        candidate.updated_at;

    }

  }


  return best;

}


// ============================================================
// USEFUL DATA CHECK
// ============================================================

function hasUsefulFlightData(
  flight
) {

  if (!flight) {
    return false;
  }


  return Boolean(

    flight.number ||

    flight.airline?.name ||

    flight.airline?.code ||

    flight.status?.value ||

    flight.departure?.airport?.code ||

    flight.departure?.airport?.name ||

    flight.arrival?.airport?.code ||

    flight.arrival?.airport?.name ||

    flight.departure?.time?.scheduled ||

    flight.arrival?.time?.scheduled

  );

}


// ============================================================
// API ERROR
// ============================================================

function sendError(
  res,
  statusCode,
  code,
  message,
  extra = {}
) {

  return res
    .status(statusCode)
    .json({

      success: false,

      error: {

        code,

        message

      },

      ...extra

    });

}


// ============================================================
// API HANDLER
// ============================================================

export default async function handler(
  req,
  res
) {

  const origin =
    req.headers.origin || "";


  setCors(
    res,
    origin
  );


  // ==========================================================
  // OPTIONS
  // ==========================================================

  if (
    req.method === "OPTIONS"
  ) {

    return res
      .status(204)
      .end();

  }


  // ==========================================================
  // METHOD
  // ==========================================================

  if (
    req.method !== "GET"
  ) {

    return sendError(
      res,
      405,
      "METHOD_NOT_ALLOWED",
      "Only GET requests are supported."
    );

  }


  // ==========================================================
  // API KEY
  // ==========================================================

  const apiKey =
    process.env.SERPAPI_KEY;


  if (!apiKey) {

    console.error(
      "SERPAPI_KEY environment variable is missing."
    );


    return sendError(
      res,
      500,
      "SERVER_CONFIGURATION_ERROR",
      "The flight search service is not configured."
    );

  }


  // ==========================================================
  // FLIGHT NUMBER
  // ==========================================================

  let flight =
    req.query.flight;


  if (
    Array.isArray(flight)
  ) {

    flight =
      flight[0];

  }


  flight =
    normalizeFlightNumber(
      flight
    );


  if (!flight) {

    return sendError(
      res,
      400,
      "MISSING_FLIGHT",
      "Please provide a flight number."
    );

  }


  // ==========================================================
  // VALIDATION
  // ==========================================================

  const flightPattern =
    /^[A-Z0-9]{2,3}[0-9]{1,4}$/;


  if (
    !flightPattern.test(
      flight
    )
  ) {

    return sendError(
      res,
      400,
      "INVALID_FLIGHT",
      "Please enter a valid flight number such as BW601."
    );

  }


  // ==========================================================
  // SEARCH QUERIES
  // ==========================================================

  const searchQueries = [

    `${flight} flight status`,

    `${flight} flight`,

    `${flight} airline flight status`

  ];


  // ==========================================================
  // SERPAPI REQUEST
  // ==========================================================

  const params =
    new URLSearchParams({

      engine:
        "google",

      q:
        searchQueries[0],

      device:
        "mobile",

      hl:
        "en",

      gl:
        "us",

      api_key:
        apiKey,

      output:
        "json"

    });


  const controller =
    new AbortController();


  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      15000
    );


  let serpResponse;


  try {

    serpResponse =
      await fetch(
        `${SERPAPI_URL}?${params.toString()}`,
        {

          method:
            "GET",

          headers: {

            Accept:
              "application/json"

          },

          signal:
            controller.signal

        }
      );

  }
  catch (error) {

    clearTimeout(
      timeout
    );


    console.error(
      "SerpApi request failed:",
      error
    );


    if (
      error &&
      error.name === "AbortError"
    ) {

      return sendError(
        res,
        504,
        "SERPAPI_TIMEOUT",
        "The flight search service took too long to respond."
      );

    }


    return sendError(
      res,
      502,
      "SERPAPI_CONNECTION_ERROR",
      "Unable to connect to the flight search service."
    );

  }


  clearTimeout(
    timeout
  );


  // ==========================================================
  // JSON
  // ==========================================================

  let serpData;


  try {

    serpData =
      await serpResponse.json();

  }
  catch (error) {

    console.error(
      "Invalid SerpApi JSON response:",
      error
    );


    return sendError(
      res,
      502,
      "INVALID_SERPAPI_RESPONSE",
      "The flight search service returned an invalid response."
    );

  }


  // ==========================================================
  // SERPAPI HTTP ERROR
  // ==========================================================

  if (
    !serpResponse.ok
  ) {

    console.error(
      "SerpApi HTTP error:",
      serpData
    );


    return sendError(
      res,
      502,
      "SERPAPI_ERROR",
      "The flight search service returned an error.",

      {
        serpapi_status:
          serpResponse.status
      }

    );

  }


  // ==========================================================
  // SERPAPI API ERROR
  // ==========================================================

  if (
    serpData?.error
  ) {

    console.error(
      "SerpApi API error:",
      serpData.error
    );


    return sendError(
      res,
      502,
      "SERPAPI_API_ERROR",
      "The flight search service returned an error."
    );

  }


  // ==========================================================
  // NORMALIZE
  // ==========================================================

  const normalizedFlight =
    normalizeFlightData(
      serpData,
      flight
    );


  // ==========================================================
  // NOT FOUND
  // ==========================================================

  if (
    !hasUsefulFlightData(
      normalizedFlight
    )
  ) {

    return res
      .status(404)
      .json({

        success:
          false,

        error: {

          code:
            "FLIGHT_NOT_FOUND",

          message:
            `No flight information was found for ${flight}.`

        },

        query: {

          flight,

          search:
            searchQueries[0],

          engine:
            "google",

          device:
            "mobile"

        },

        raw:
          serpData

      });

  }


  // ==========================================================
  // SUCCESS
  // ==========================================================

  return res
    .status(200)
    .json({

      success:
        true,

      query: {

        flight,

        search:
          searchQueries[0],

        engine:
          "google",

        device:
          "mobile"

      },

      flight:
        normalizedFlight,

      // ------------------------------------------------------
      // Additional diagnostic information
      // ------------------------------------------------------

      availability: {

        flight_number:
          Boolean(
            normalizedFlight.number
          ),

        airline:
          Boolean(
            normalizedFlight.airline?.name
          ),

        airline_code:
          Boolean(
            normalizedFlight.airline?.code
          ),

        airline_logo:
          Boolean(
            normalizedFlight.airline?.logo
          ),

        status:
          Boolean(
            normalizedFlight.status?.value
          ),

        status_description:
          Boolean(
            normalizedFlight.status?.description
          ),

        departure_airport:
          Boolean(
            normalizedFlight.departure?.airport?.code ||
            normalizedFlight.departure?.airport?.name
          ),

        departure_city:
          Boolean(
            normalizedFlight.departure?.airport?.city
          ),

        departure_time:
          Boolean(
            normalizedFlight.departure?.time?.scheduled ||
            normalizedFlight.departure?.time?.estimated ||
            normalizedFlight.departure?.time?.actual
          ),

        departure_terminal:
          Boolean(
            normalizedFlight.departure?.terminal
          ),

        departure_gate:
          Boolean(
            normalizedFlight.departure?.gate
          ),

        arrival_airport:
          Boolean(
            normalizedFlight.arrival?.airport?.code ||
            normalizedFlight.arrival?.airport?.name
          ),

        arrival_city:
          Boolean(
            normalizedFlight.arrival?.airport?.city
          ),

        arrival_time:
          Boolean(
            normalizedFlight.arrival?.time?.scheduled ||
            normalizedFlight.arrival?.time?.estimated ||
            normalizedFlight.arrival?.time?.actual
          ),

        arrival_terminal:
          Boolean(
            normalizedFlight.arrival?.terminal
          ),

        arrival_gate:
          Boolean(
            normalizedFlight.arrival?.gate
          ),

        aircraft:
          Boolean(
            normalizedFlight.aircraft?.name ||
            normalizedFlight.aircraft?.model ||
            normalizedFlight.aircraft?.type
          ),

        registration:
          Boolean(
            normalizedFlight.aircraft?.registration
          ),

        duration:
          Boolean(
            normalizedFlight.duration
          ),

        baggage:
          Boolean(
            normalizedFlight.arrival?.baggage
          ),

        progress:
          Boolean(
            normalizedFlight.progress?.percentage !== null ||
            normalizedFlight.progress?.text
          ),

        last_updated:
          Boolean(
            normalizedFlight.updated_at
          )

      },

      // ------------------------------------------------------
      // Raw Google/SerpApi response
      // ------------------------------------------------------

      raw:
        serpData

    });

}
