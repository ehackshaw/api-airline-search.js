/**
 * =========================================================
 * BOKKARA AIRLINE SEARCH API
 * =========================================================
 *
 * Endpoint:
 *
 * /api/airline-search?flight=EK181&date=2026-09-08
 *
 * Returns one normalized flight-status object.
 *
 * Data source:
 * SerpApi -> Google Search
 * =========================================================
 */

const SERPAPI_URL =
  "https://serpapi.com/search.json";

const REQUEST_TIMEOUT_MS =
  25000;


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
   JSON
   ========================================================= */

function sendJson(
  res,
  status,
  body
) {

  setCors(res);

  return res
    .status(status)
    .json(body);

}


/* =========================================================
   CLEAN VALUE
   ========================================================= */

function clean(value) {

  if (
    value === undefined ||
    value === null
  ) {

    return null;

  }

  const valueString =
    String(value).trim();

  return valueString || null;

}


/* =========================================================
   FIRST AVAILABLE VALUE
   ========================================================= */

function first(...values) {

  for (
    const value of values
  ) {

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


/* =========================================================
   FLIGHT NORMALIZATION
   ========================================================= */

function normalizeFlight(value) {

  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .trim();

}


/* =========================================================
   DISPLAY FLIGHT
   ========================================================= */

function displayFlight(value) {

  const normalized =
    normalizeFlight(value);

  const match =
    normalized.match(
      /^([A-Z0-9]{2,3})(\d+)$/
    );

  if (!match) {

    return normalized;

  }

  return (
    `${match[1]} ${match[2]}`
  );

}


/* =========================================================
   VALIDATE DATE
   ========================================================= */

function isValidDate(value) {

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {

    return false;

  }

  const date =
    new Date(
      `${value}T00:00:00Z`
    );

  return (
    !isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );

}


/* =========================================================
   DATE -> MONTH/DAY
   ========================================================= */

function requestedMonthDay(
  requestedDate
) {

  const match =
    String(requestedDate)
      .match(
        /^\d{4}-(\d{2})-(\d{2})$/
      );

  if (!match) {

    return null;

  }

  return {
    month:
      Number(match[1]),

    day:
      Number(match[2])
  };

}


/* =========================================================
   CHECK DATE TEXT
   ========================================================= */

function dateTextMatchesRequestedDate(
  value,
  requestedDate
) {

  if (!value) {

    return false;

  }

  const target =
    requestedMonthDay(
      requestedDate
    );

  if (!target) {

    return false;

  }


  const text =
    String(value)
      .trim();


  /*
   YYYY-MM-DD
  */

  const iso =
    text.match(
      /^(\d{4})-(\d{2})-(\d{2})/
    );

  if (iso) {

    return (
      Number(iso[2]) === target.month &&
      Number(iso[3]) === target.day
    );

  }


  /*
   Google format examples:

   Tue, Jul 16
   Fri, Sep 5
   Tue Jul 16
  */

  const months = {
    jan: 1,
    january: 1,
    feb: 2,
    february: 2,
    mar: 3,
    march: 3,
    apr: 4,
    april: 4,
    may: 5,
    jun: 6,
    june: 6,
    jul: 7,
    july: 7,
    aug: 8,
    august: 8,
    sep: 9,
    september: 9,
    oct: 10,
    october: 10,
    nov: 11,
    november: 11,
    dec: 12,
    december: 12
  };


  const match =
    text.match(
      /(?:^|[\s,])([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:\D|$)/
    );


  if (!match) {

    return false;

  }


  const month =
    months[
      match[1].toLowerCase()
    ];


  const day =
    Number(match[2]);


  return (
    month === target.month &&
    day === target.day
  );

}


/* =========================================================
   FETCH WITH TIMEOUT
   ========================================================= */

async function fetchWithTimeout(
  url
) {

  const controller =
    new AbortController();


  const timeout =
    setTimeout(
      () => {
        controller.abort();
      },
      REQUEST_TIMEOUT_MS
    );


  try {

    return await fetch(
      url,
      {
        method: "GET",

        signal:
          controller.signal,

        headers: {
          Accept:
            "application/json"
        }
      }
    );

  } finally {

    clearTimeout(timeout);

  }

}


/* =========================================================
   SERPAPI
   ========================================================= */

async function searchSerpApi(
  query
) {

  const apiKey =
    process.env.SERPAPI_KEY;


  if (!apiKey) {

    throw new Error(
      "SERPAPI_KEY is not configured."
    );

  }


  const url =
    new URL(
      SERPAPI_URL
    );


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
    "device",
    "desktop"
  );


  const response =
    await fetchWithTimeout(
      url.toString()
    );


  const text =
    await response.text();


  let data;


  try {

    data =
      JSON.parse(text);

  } catch {

    throw new Error(
      "SerpApi returned invalid JSON."
    );

  }


  if (!response.ok) {

    throw new Error(
      data?.error ||
      `SerpApi request failed with ${response.status}.`
    );

  }


  if (data?.error) {

    throw new Error(
      data.error
    );

  }


  return data;

}


/* =========================================================
   FIND FLIGHT STATUS BOXES
   ========================================================= */

function findFlightStatusBoxes(
  data
) {

  const results = [];


  if (
    data?.answer_box
  ) {

    const box =
      data.answer_box;


    if (
      box.type ===
      "flight_status"
    ) {

      results.push(box);

    }

  }


  if (
    Array.isArray(
      data?.answer_box_list
    )
  ) {

    for (
      const box
      of data.answer_box_list
    ) {

      if (
        box?.type ===
        "flight_status"
      ) {

        results.push(box);

      }

    }

  }


  return results;

}


/* =========================================================
   FIND FLIGHT INSIDE STATUS BOX
   ========================================================= */

function findFlightInAnswerBox(
  box,
  requestedFlight,
  requestedDate
) {

  const requested =
    normalizeFlight(
      requestedFlight
    );


  /*
   -----------------------------------------
   SINGLE FLIGHT
   -----------------------------------------
  */

  if (
    box.flight_number
  ) {

    const candidate =
      normalizeFlight(
        box.flight_number
      );


    if (
      candidate === requested
    ) {

      return box;

    }

  }


  /*
   -----------------------------------------
   MULTIPLE FLIGHTS
   -----------------------------------------
  */

  if (
    Array.isArray(
      box.flights
    )
  ) {

    /*
     First try exact flight AND date.
    */

    const exact =
      box.flights.find(
        flight => {

          const candidate =
            normalizeFlight(
              first(
                flight.flight_number,
                flight.flight_name,
                flight.flight_designator
              )
            );


          if (
            candidate !== requested
          ) {

            return false;

          }


          const departureDate =
            first(
              flight.departure?.date,
              flight.departure?.time
            );


          const arrivalDate =
            first(
              flight.arrival?.date,
              flight.arrival?.time
            );


          return (
            dateTextMatchesRequestedDate(
              departureDate,
              requestedDate
            ) ||
            dateTextMatchesRequestedDate(
              arrivalDate,
              requestedDate
            )
          );

        }
      );


    if (exact) {

      return {
        ...box,
        ...exact
      };

    }


    /*
     Then exact flight regardless
     of whether Google exposes the
     date in machine-readable form.
    */

    const flightOnly =
      box.flights.find(
        flight => {

          const candidate =
            normalizeFlight(
              first(
                flight.flight_number,
                flight.flight_name,
                flight.flight_designator
              )
            );


          return (
            candidate === requested
          );

        }
      );


    if (flightOnly) {

      return {
        ...box,
        ...flightOnly
      };

    }

  }


  return null;

}


/* =========================================================
   AIRPORT CODE
   ========================================================= */

function getAirportCode(
  airport
) {

  if (!airport) {

    return null;

  }


  if (
    typeof airport === "string"
  ) {

    /*
     Usually:

     JFK
     DXB
     POS
    */

    const match =
      airport.match(
        /\b([A-Z]{3})\b/
      );


    return match
      ? match[1]
      : airport.trim();

  }


  return clean(
    first(

      airport.id,

      airport.code,

      airport.iata,

      airport.airport_id,

      airport.airport_code,

      airport.airport_name

    )
  );

}


/* =========================================================
   AIRPORT CITY
   ========================================================= */

function getAirportCity(
  airport
) {

  if (!airport) {

    return null;

  }


  if (
    typeof airport === "string"
  ) {

    return airport;

  }


  return clean(
    first(

      airport.location,

      airport.city,

      airport.city_name,

      airport.airport_city,

      airport.name

    )
  );

}


/* =========================================================
   AIRLINE NAME
   ========================================================= */

function getAirlineName(
  flight
) {

  return clean(
    first(

      flight.airline,

      flight.airline_name,

      flight.carrier,

      flight.carrier_name,

      flight.operator,

      flight.metadata?.airline,

      flight.metadata?.carrier

    )
  );

}


/* =========================================================
   AIRLINE CODE
   ========================================================= */

function getAirlineCode(
  flight
) {

  const direct =
    clean(
      first(

        flight.airline_iata_code,

        flight.airline_code,

        flight.carrier_code,

        flight.iata,

        flight.metadata?.airline_iata_code,

        flight.metadata?.airline_code

      )
    );


  if (direct) {

    return direct
      .toUpperCase();

  }


  /*
   Try extracting from:

   "United UA 160"
   "UA 160"
   "EK181"
  */

  const flightNumber =
    clean(
      first(

        flight.flight_number,

        flight.flight_designator

      )
    );


  if (flightNumber) {

    const match =
      normalizeFlight(
        flightNumber
      ).match(
        /^([A-Z0-9]{2,3})\d+$/
      );


    if (match) {

      return match[1];

    }

  }


  return null;

}


/* =========================================================
   FLIGHT NUMBER ONLY
   ========================================================= */

function getFlightNumber(
  flight,
  requestedFlight
) {

  const value =
    clean(
      first(

        flight.flight_number,

        flight.flight_designator,

        flight.metadata?.flight_number,

        requestedFlight

      )
    );


  if (!value) {

    return null;

  }


  const normalized =
    normalizeFlight(
      value
    );


  const match =
    normalized.match(
      /^([A-Z0-9]{2,3})(\d+)$/
    );


  if (match) {

    return match[2];

  }


  /*
   If Google returned:

   "UA 160"

   remove the airline code.
  */

  const parts =
    String(value)
      .trim()
      .split(
        /\s+/
      );


  if (
    parts.length >= 2
  ) {

    const last =
      parts[parts.length - 1];


    if (
      /^\d+$/.test(last)
    ) {

      return last;

    }

  }


  return value;

}


/* =========================================================
   BUILD NORMALIZED RESPONSE
   ========================================================= */

function buildNormalizedFlight(
  flight,
  requestedFlight,
  requestedDate
) {

  const departure =
    flight.departure ||
    flight.departure_airport ||
    {};


  const arrival =
    flight.arrival ||
    flight.arrival_airport ||
    {};


  const sources =
    Array.isArray(
      flight.sources
    )
      ? flight.sources
      : [];


  const source =
    sources[0] || {};


  const airlineName =
    getAirlineName(
      flight
    );


  const airlineCode =
    getAirlineCode(
      flight
    );


  const numericFlight =
    getFlightNumber(
      flight,
      requestedFlight
    );


  const fullFlight =
    clean(
      first(

        flight.flight_number,

        flight.flight_designator,

        flight.title,

        displayFlight(
          requestedFlight
        )

      )
    );


  const departureCode =
    getAirportCode(
      departure
    );


  const arrivalCode =
    getAirportCode(
      arrival
    );


  const departureCity =
    getAirportCity(
      departure
    );


  const arrivalCity =
    getAirportCity(
      arrival
    );


  const departurePlanned =
    clean(
      first(

        departure.planned_time,

        departure.scheduled_time_label,

        departure.scheduled_time,

        departure.time

      )
    );


  const departureActual =
    clean(
      first(

        departure.actual_time,

        departure.time_label,

        departure.time

      )
    );


  const arrivalPlanned =
    clean(
      first(

        arrival.planned_time,

        arrival.scheduled_time_label,

        arrival.scheduled_time,

        arrival.time

      )
    );


  const arrivalActual =
    clean(
      first(

        arrival.actual_time,

        arrival.time_label,

        arrival.time

      )
    );


  const status =
    clean(
      first(

        flight.flight_status,

        flight.status,

        flight.metadata?.status

      )
    );


  const updated =
    clean(
      first(

        flight.latest_update,

        flight.updated_label,

        flight.updated_at

      )
    );


  /*
   IMPORTANT:

   This is the canonical structure
   the Shopify frontend should consume.
  */

  const normalized = {

    airline:
      airlineName,

    airline_code:
      airlineCode,

    flight_number:
      numericFlight,

    flight_designator:
      fullFlight,

    title:
      clean(
        first(
          flight.title,
          airlineName
            ? `${airlineName} ${displayFlight(requestedFlight)}`
            : displayFlight(requestedFlight)
        )
      ),

    status:
      status,

    route:
      clean(
        first(
          flight.destination,

          departureCity &&
          arrivalCity
            ? `${departureCity} to ${arrivalCity}`
            : null
        )
      ),

    date:
      requestedDate,

    departure: {

      airport_code:
        departureCode,

      city:
        departureCity,

      date:
        clean(
          first(
            departure.date,
            requestedDate
          )
        ),

      planned_time:
        departurePlanned,

      actual_time:
        departureActual,

      terminal:
        clean(
          departure.terminal
        ),

      gate:
        clean(
          departure.gate
        )

    },

    arrival: {

      airport_code:
        arrivalCode,

      city:
        arrivalCity,

      date:
        clean(
          first(
            arrival.date,
            requestedDate
          )
        ),

      planned_time:
        arrivalPlanned,

      actual_time:
        arrivalActual,

      terminal:
        clean(
          arrival.terminal
        ),

      gate:
        clean(
          arrival.gate
        )

    },

    updated_text:
      updated,

    source:
      clean(
        first(
          source.name,
          flight.source
        )
      ),

    source_url:
      clean(
        first(
          source.link,
          flight.source_url
        )
      )

  };


  /*
   ---------------------------------------------------------
   COMPATIBILITY FIELDS
   ---------------------------------------------------------

   These are intentionally included because
   your Shopify section has previously used
   several different field names.
  */

  normalized.origin_code =
    departureCode;

  normalized.destination_code =
    arrivalCode;

  normalized.origin_city =
    departureCity;

  normalized.destination_city =
    arrivalCity;

  normalized.destination_label =
    arrivalCity;

  normalized.departure_time =
    clean(
      first(
        departureActual,
        departurePlanned
      )
    );

  normalized.actual_departure =
    departureActual;

  normalized.scheduled_departure =
    departurePlanned;

  normalized.actual_arrival =
    arrivalActual;

  normalized.scheduled_arrival =
    arrivalPlanned;

  normalized.departure_terminal =
    clean(
      departure.terminal
    );

  normalized.departure_gate =
    clean(
      departure.gate
    );

  normalized.arrival_terminal =
    clean(
      arrival.terminal
    );

  normalized.arrival_gate =
    clean(
      arrival.gate
    );

  normalized.local_time_text =
    clean(
      first(
        flight.local_time_text,
        flight.local_time
      )
    );


  return normalized;

}


/* =========================================================
   MAIN SEARCH
   ========================================================= */

async function searchFlight(
  requestedFlight,
  requestedDate
) {

  const normalizedFlight =
    normalizeFlight(
      requestedFlight
    );


  const displayName =
    displayFlight(
      requestedFlight
    );


  /*
   Google flight-status searches.
  */

  const queries = [

    `"${displayName}" flight status ${requestedDate}`,

    `"${normalizedFlight}" flight status ${requestedDate}`,

    `${displayName} flight status ${requestedDate}`

  ];


  for (
    const query
    of queries
  ) {

    const data =
      await searchSerpApi(
        query
      );


    const boxes =
      findFlightStatusBoxes(
        data
      );


    for (
      const box
      of boxes
    ) {

      const flight =
        findFlightInAnswerBox(
          box,
          normalizedFlight,
          requestedDate
        );


      if (
        flight
      ) {

        return buildNormalizedFlight(
          flight,
          normalizedFlight,
          requestedDate
        );

      }

    }

  }


  return null;

}


/* =========================================================
   HANDLER
   ========================================================= */

export default async function handler(
  req,
  res
) {

  setCors(res);


  /*
   OPTIONS
  */

  if (
    req.method === "OPTIONS"
  ) {

    return res
      .status(204)
      .end();

  }


  /*
   GET ONLY
  */

  if (
    req.method !== "GET"
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


  try {

    /*
     -----------------------------------------
     PARAMETERS
     -----------------------------------------
    */

    const rawFlight =
      String(
        req.query.flight || ""
      ).trim();


    const requestedDate =
      String(
        req.query.date || ""
      ).trim();


    /*
     -----------------------------------------
     REQUIRED
     -----------------------------------------
    */

    if (!rawFlight) {

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


    if (!requestedDate) {

      return sendJson(
        res,
        400,
        {
          success: false,

          error:
            "Missing date parameter."
        }
      );

    }


    if (
      !isValidDate(
        requestedDate
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


    const normalizedFlight =
      normalizeFlight(
        rawFlight
      );


    if (!normalizedFlight) {

      return sendJson(
        res,
        400,
        {
          success: false,

          error:
            "Invalid flight number."
        }
      );

    }


    /*
     -----------------------------------------
     SEARCH
     -----------------------------------------
    */

    const flight =
      await searchFlight(
        normalizedFlight,
        requestedDate
      );


    /*
     -----------------------------------------
     NOT FOUND
     -----------------------------------------
    */

    if (!flight) {

      return sendJson(
        res,
        404,
        {

          success: false,

          error:
            `No flight status was found for ${displayFlight(normalizedFlight)} on ${requestedDate}.`,

          query: {

            flight:
              rawFlight,

            normalized_flight:
              normalizedFlight,

            date:
              requestedDate

          }

        }
      );

    }


    /*
     =====================================================
     IMPORTANT
     =====================================================

     Return the SAME normalized data in several
     locations for frontend compatibility.
     */

    return sendJson(
      res,
      200,
      {

        success: true,

        query: {

          flight:
            rawFlight,

          normalized_flight:
            normalizedFlight,

          date:
            requestedDate

        },

        /*
         New clean format
        */

        flight:
          flight,

        /*
         Compatibility format
        */

        flight_result:
          flight,

        /*
         Additional compatibility
        */

        data:
          flight

      }
    );


  } catch (error) {

    console.error(
      "Bokkara Airline Search Error:",
      error
    );


    return sendJson(
      res,
      500,
      {

        success: false,

        error:
          error?.message ||
          "Unable to retrieve flight information."

      }
    );

  }

}
