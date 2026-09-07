/**
 * BOKKARA FLIGHT STATUS BACKEND
 *
 * GET:
 * /api/flight-status?flight=BW601
 *
 * Uses:
 * SerpApi Google Search
 *
 * Environment variable:
 * SERPAPI_KEY
 */

const SERPAPI_URL = "https://serpapi.com/search";

const ALLOWED_ORIGINS = [
  "https://bokkara.com",
  "https://www.bokkara.com",
  "https://bokkara.myshopify.com"
];

function setCors(req, res) {
  const origin = req.headers.origin;

  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    // Allows Shopify/custom domains during development.
    // Restrict this later if desired.
    res.setHeader("Access-Control-Allow-Origin", "*");
  }

  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");
}

function cleanFlightNumber(value) {
  if (!value) return "";

  return String(value)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function isValidFlightNumber(value) {
  /*
   * Examples:
   * BW601
   * AA100
   * B6101
   * UA1234
   *
   * We intentionally allow 2-3 letters followed by
   * 1-4 numbers, with an optional airline designator
   * such as BW601.
   */

  return /^[A-Z0-9]{2,3}[0-9]{1,4}$/.test(value);
}

function firstValue(...values) {
  for (const value of values) {
    if (
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ""
    ) {
      return value;
    }
  }

  return null;
}

function stringValue(...values) {
  const value = firstValue(...values);

  if (value === null) return null;

  return String(value).trim();
}

function numberValue(...values) {
  const value = firstValue(...values);

  if (value === null) return null;

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function normalizeText(value) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === "string") {
    return value.trim() || null;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return null;
}

function findFlightObjects(data) {
  const objects = [];

  function walk(value, path = "") {
    if (!value || typeof value !== "object") return;

    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        walk(item, `${path}[${index}]`);
      });

      return;
    }

    const keys = Object.keys(value).map((key) => key.toLowerCase());

    const hasFlightSignal =
      keys.some((key) =>
        [
          "flight",
          "flight_number",
          "flightnumber",
          "airline",
          "departure",
          "arrival",
          "origin",
          "destination",
          "status"
        ].includes(key)
      );

    if (hasFlightSignal) {
      objects.push({
        value,
        path
      });
    }

    for (const [key, child] of Object.entries(value)) {
      if (child && typeof child === "object") {
        walk(child, path ? `${path}.${key}` : key);
      }
    }
  }

  walk(data);

  return objects;
}

function findValueDeep(data, possibleKeys) {
  const wanted = possibleKeys.map((key) => key.toLowerCase());

  function walk(value) {
    if (!value || typeof value !== "object") {
      return null;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        const result = walk(item);

        if (result !== null) {
          return result;
        }
      }

      return null;
    }

    for (const [key, child] of Object.entries(value)) {
      if (wanted.includes(key.toLowerCase())) {
        if (
          child !== undefined &&
          child !== null &&
          String(child).trim() !== ""
        ) {
          return child;
        }
      }
    }

    for (const child of Object.values(value)) {
      if (child && typeof child === "object") {
        const result = walk(child);

        if (result !== null) {
          return result;
        }
      }
    }

    return null;
  }

  return walk(data);
}

function extractAirport(value) {
  if (!value) {
    return {
      code: null,
      name: null,
      city: null,
      country: null
    };
  }

  if (typeof value === "string") {
    return {
      code: value.length <= 4 ? value : null,
      name: value.length > 4 ? value : null,
      city: null,
      country: null
    };
  }

  if (typeof value === "object") {
    return {
      code: stringValue(
        value.code,
        value.iata,
        value.iata_code,
        value.airport_code
      ),

      name: stringValue(
        value.name,
        value.airport,
        value.airport_name
      ),

      city: stringValue(
        value.city,
        value.city_name
      ),

      country: stringValue(
        value.country,
        value.country_name
      )
    };
  }

  return {
    code: null,
    name: null,
    city: null,
    country: null
  };
}

function extractTimeObject(value) {
  if (!value) {
    return {
      scheduled: null,
      estimated: null,
      actual: null,
      timezone: null
    };
  }

  if (typeof value === "string") {
    return {
      scheduled: value,
      estimated: null,
      actual: null,
      timezone: null
    };
  }

  if (typeof value === "object") {
    return {
      scheduled: stringValue(
        value.scheduled,
        value.scheduled_time,
        value.time,
        value.datetime
      ),

      estimated: stringValue(
        value.estimated,
        value.estimated_time
      ),

      actual: stringValue(
        value.actual,
        value.actual_time
      ),

      timezone: stringValue(
        value.timezone,
        value.tz
      )
    };
  }

  return {
    scheduled: null,
    estimated: null,
    actual: null,
    timezone: null
  };
}

function extractProgress(data) {
  const progress = numberValue(
    findValueDeep(data, [
      "progress",
      "progress_percent",
      "progress_percentage",
      "completion"
    ])
  );

  if (progress !== null) {
    return Math.max(0, Math.min(100, progress));
  }

  const status = stringValue(
    findValueDeep(data, ["status"])
  );

  if (!status) return null;

  const lower = status.toLowerCase();

  if (
    lower.includes("arrived") ||
    lower.includes("landed") ||
    lower.includes("complete")
  ) {
    return 100;
  }

  if (
    lower.includes("boarding") ||
    lower.includes("departed") ||
    lower.includes("en route") ||
    lower.includes("airborne")
  ) {
    return 50;
  }

  if (
    lower.includes("scheduled") ||
    lower.includes("on time")
  ) {
    return 0;
  }

  return null;
}

function normalizeFlightData(raw, requestedFlight) {
  const flightObjects = findFlightObjects(raw);

  const primary =
    flightObjects.length > 0
      ? flightObjects[0].value
      : raw;

  const airlineObject =
    findValueDeep(primary, [
      "airline"
    ]);

  let airlineName = null;
  let airlineLogo = null;

  if (typeof airlineObject === "object") {
    airlineName = stringValue(
      airlineObject.name,
      airlineObject.airline_name
    );

    airlineLogo = stringValue(
      airlineObject.logo,
      airlineObject.logo_url,
      airlineObject.image
    );
  } else {
    airlineName = normalizeText(airlineObject);
  }

  airlineName = firstValue(
    airlineName,
    findValueDeep(raw, [
      "airline_name",
      "carrier_name"
    ])
  );

  airlineLogo = firstValue(
    airlineLogo,
    findValueDeep(raw, [
      "airline_logo",
      "logo_url",
      "logo"
    ])
  );

  const flightNumber = stringValue(
    findValueDeep(primary, [
      "flight_number",
      "flightnumber",
      "flight"
    ]),
    requestedFlight
  );

  const status = stringValue(
    findValueDeep(primary, [
      "status",
      "flight_status"
    ])
  );

  const statusDescription = stringValue(
    findValueDeep(primary, [
      "status_description",
      "status_text",
      "description"
    ])
  );

  const originRaw = firstValue(
    findValueDeep(primary, [
      "origin",
      "departure_airport",
      "departure"
    ]),
    findValueDeep(raw, [
      "origin",
      "departure_airport"
    ])
  );

  const destinationRaw = firstValue(
    findValueDeep(primary, [
      "destination",
      "arrival_airport",
      "arrival"
    ]),
    findValueDeep(raw, [
      "destination",
      "arrival_airport"
    ])
  );

  const origin = extractAirport(originRaw);
  const destination = extractAirport(destinationRaw);

  const departureRaw = findValueDeep(primary, [
    "departure",
    "departure_time",
    "departure_datetime"
  ]);

  const arrivalRaw = findValueDeep(primary, [
    "arrival",
    "arrival_time",
    "arrival_datetime"
  ]);

  const departureTime = extractTimeObject(departureRaw);
  const arrivalTime = extractTimeObject(arrivalRaw);

  const aircraft = stringValue(
    findValueDeep(primary, [
      "aircraft",
      "aircraft_type",
      "aircraft_name",
      "plane"
    ])
  );

  const aircraftRegistration = stringValue(
    findValueDeep(primary, [
      "registration",
      "aircraft_registration",
      "tail_number"
    ])
  );

  const duration = stringValue(
    findValueDeep(primary, [
      "duration",
      "flight_duration"
    ])
  );

  const terminal = stringValue(
    findValueDeep(primary, [
      "terminal",
      "departure_terminal"
    ])
  );

  const arrivalTerminal = stringValue(
    findValueDeep(primary, [
      "arrival_terminal"
    ])
  );

  const gate = stringValue(
    findValueDeep(primary, [
      "gate",
      "departure_gate"
    ])
  );

  const arrivalGate = stringValue(
    findValueDeep(primary, [
      "arrival_gate"
    ])
  );

  const baggage = stringValue(
    findValueDeep(primary, [
      "baggage",
      "baggage_claim",
      "baggage_carousel"
    ])
  );

  const date = stringValue(
    findValueDeep(primary, [
      "date",
      "flight_date",
      "departure_date"
    ])
  );

  const delay = stringValue(
    findValueDeep(primary, [
      "delay",
      "delay_text",
      "delay_duration"
    ])
  );

  const progress = extractProgress(raw);

  return {
    number: flightNumber,

    airline: {
      name: airlineName,
      logo: airlineLogo
    },

    status: {
      value: status,
      description: statusDescription,
      delay
    },

    date,

    departure: {
      airport: origin,
      time: departureTime,
      terminal,
      gate
    },

    arrival: {
      airport: destination,
      time: arrivalTime,
      terminal: arrivalTerminal,
      gate: arrivalGate,
      baggage
    },

    aircraft: {
      name: aircraft,
      registration: aircraftRegistration
    },

    duration,

    progress: {
      percentage: progress
    },

    requested_flight: requestedFlight
  };
}

function findLikelyFlightResult(raw, requestedFlight) {
  const lowerRequested = requestedFlight.toLowerCase();

  const candidates = [];

  function walk(value) {
    if (!value || typeof value !== "object") return;

    if (Array.isArray(value)) {
      for (const item of value) {
        walk(item);
      }

      return;
    }

    const serialized = JSON.stringify(value).toLowerCase();

    if (serialized.includes(lowerRequested)) {
      candidates.push(value);
    }

    for (const child of Object.values(value)) {
      if (child && typeof child === "object") {
        walk(child);
      }
    }
  }

  walk(raw);

  return candidates.length > 0
    ? candidates[0]
    : null;
}

module.exports = async function handler(req, res) {
  setCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  const apiKey = process.env.SERPAPI_KEY;

  if (!apiKey) {
    return res.status(500).json({
      success: false,
      error: "SERPAPI_KEY is not configured."
    });
  }

  const requestedFlight = cleanFlightNumber(
    req.query.flight
  );

  if (!requestedFlight) {
    return res.status(400).json({
      success: false,
      error: "Missing flight number.",
      example: "/api/flight-status?flight=BW601"
    });
  }

  if (!isValidFlightNumber(requestedFlight)) {
    return res.status(400).json({
      success: false,
      error: "Invalid flight number.",
      flight: requestedFlight
    });
  }

  /*
   * Searching the flight number together with "flight status"
   * helps Google identify the flight-information result.
   */
  const query = `${requestedFlight} flight status`;

  const params = new URLSearchParams({
    engine: "google",
    q: query,
    device: "mobile",
    hl: "en",
    gl: "us",
    api_key: apiKey,
    output: "json"
  });

  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 15000);

  let response;

  try {
    response = await fetch(
      `${SERPAPI_URL}?${params.toString()}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json"
        },
        signal: controller.signal
      }
    );
  } catch (error) {
    clearTimeout(timeout);

    if (error.name === "AbortError") {
      return res.status(504).json({
        success: false,
        error: "Flight search timed out."
      });
    }

    console.error("SerpApi request failed:", error);

    return res.status(502).json({
      success: false,
      error: "Unable to reach the flight search provider."
    });
  }

  clearTimeout(timeout);

  let raw;

  try {
    raw = await response.json();
  } catch (error) {
    return res.status(502).json({
      success: false,
      error: "Invalid response from flight search provider."
    });
  }

  if (!response.ok) {
    console.error("SerpApi error:", raw);

    return res.status(response.status >= 500 ? 502 : 400).json({
      success: false,
      error:
        raw?.error ||
        "Flight search provider returned an error."
    });
  }

  if (raw?.error) {
    return res.status(502).json({
      success: false,
      error: raw.error
    });
  }

  const matchedFlight = findLikelyFlightResult(
    raw,
    requestedFlight
  );

  const flight = normalizeFlightData(
    matchedFlight || raw,
    requestedFlight
  );

  const hasUsefulData =
    flight.number ||
    flight.airline.name ||
    flight.departure.airport.code ||
    flight.arrival.airport.code ||
    flight.status.value;

  if (!hasUsefulData) {
    return res.status(404).json({
      success: false,
      error: "Flight information could not be found.",
      flight: requestedFlight,
      query,
      data: null
    });
  }

  return res.status(200).json({
    success: true,

    query: {
      flight: requestedFlight,
      search: query,
      engine: "google",
      device: "mobile"
    },

    flight,

    /*
     * Keep the complete SerpApi response available.
     *
     * This allows us to add more fields later without
     * having to rebuild the backend.
     */
    raw
  });
};
