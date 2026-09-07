/**
 * =========================================================
 * BOKKARA AIRLINE SEARCH API
 * VERCEL SERVERLESS FUNCTION
 * =========================================================
 *
 * Endpoint:
 *
 * /api/airline-search?flight=B6%20117&date=2026-09-07
 *
 * Returns ONLY the requested flight/date.
 *
 * SERPAPI:
 * Google Search
 *
 * Supports:
 *
 * 1. flight_result
 * 2. answer_box flight_status
 * 3. nested flight result structures
 *
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
   JSON RESPONSE
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
   DATE VALIDATION
========================================================= */

function isValidDate(value) {

  if (
    typeof value !== "string"
  ) {
    return false;
  }

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      value
    )
  ) {
    return false;
  }

  const date =
    new Date(
      `${value}T00:00:00Z`
    );

  return (
    !isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) ===
      value
  );

}


/* =========================================================
   NORMALIZE FLIGHT
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

  if (!normalized) {
    return "";
  }


  /*
    B6117
    -> B6 117

    BW601
    -> BW 601

    IB5634
    -> IB 5634
  */

  /*
    First try the common
    2-character airline code.
  */

  let match =
    normalized.match(
      /^([A-Z]{2})(\d+)$/
    );

  if (match) {

    return (
      match[1] +
      " " +
      match[2]
    );

  }


  /*
    Try 3-character airline code.
  */

  match =
    normalized.match(
      /^([A-Z]{3})(\d+)$/
    );

  if (match) {

    return (
      match[1] +
      " " +
      match[2]
    );

  }


  return String(value || "")
    .trim();

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

    clearTimeout(
      timeout
    );

  }

}


/* =========================================================
   SERPAPI GOOGLE SEARCH
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
    "mobile"
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
      JSON.parse(
        text
      );

  } catch {

    throw new Error(
      "SerpApi returned invalid JSON."
    );

  }


  if (!response.ok) {

    throw new Error(
      data?.error ||
      `SerpApi returned HTTP ${response.status}.`
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
   NORMALIZE DATE
========================================================= */

function normalizeDate(
  value
) {

  if (!value) {
    return null;
  }


  const string =
    String(value)
      .trim();


  /*
    YYYY-MM-DD
  */

  const exact =
    string.match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    );

  if (exact) {

    return (
      `${exact[1]}-${exact[2]}-${exact[3]}`
    );

  }


  /*
    ISO timestamp
  */

  const iso =
    string.match(
      /^(\d{4})-(\d{2})-(\d{2})T/
    );

  if (iso) {

    return (
      `${iso[1]}-${iso[2]}-${iso[3]}`
    );

  }


  /*
    Google-style date:

    Tue, Jul 16
    Jul 16, 2026

    These are intentionally
    handled conservatively.
  */

  const parsed =
    new Date(
      string
    );

  if (
    !isNaN(
      parsed.getTime()
    )
  ) {

    const year =
      parsed.getUTCFullYear();

    const month =
      String(
        parsed.getUTCMonth() + 1
      ).padStart(
        2,
        "0"
      );

    const day =
      String(
        parsed.getUTCDate()
      ).padStart(
        2,
        "0"
      );

    return (
      `${year}-${month}-${day}`
    );

  }


  return null;

}


/* =========================================================
   NORMALIZE CANDIDATE FLIGHT
========================================================= */

function flightMatches(
  flightResult,
  requestedFlight
) {

  if (
    !flightResult ||
    typeof flightResult !== "object"
  ) {
    return false;
  }


  const requested =
    normalizeFlight(
      requestedFlight
    );


  if (!requested) {
    return false;
  }


  const candidates = [

    flightResult.flight_designator,

    flightResult.flight_number,

    flightResult.flightNumber,

    flightResult.title,

    flightResult.codeshare,

    flightResult.metadata?.flight_number,

    flightResult.metadata?.flight_designator,

    flightResult.metadata?.flightNumber,

    flightResult.answer_box?.flight_number

  ];


  for (
    const candidate
    of candidates
  ) {

    const normalized =
      normalizeFlight(
        candidate
      );


    if (!normalized) {
      continue;
    }


    if (
      normalized ===
      requested
    ) {

      return true;

    }


    if (
      normalized.includes(
        requested
      )
    ) {

      return true;

    }


    if (
      requested.includes(
        normalized
      )
    ) {

      return true;

    }

  }


  return false;

}


/* =========================================================
   FIND EXACT DATE IN dates[]
========================================================= */

function findExactDateRecord(
  flightResult,
  requestedDate
) {

  if (
    !Array.isArray(
      flightResult?.dates
    )
  ) {

    return null;

  }


  for (
    const record
    of flightResult.dates
  ) {

    if (!record) {
      continue;
    }


    const date =
      normalizeDate(
        record.date
      );


    if (
      date ===
      requestedDate
    ) {

      return record;

    }

  }


  return null;

}


/* =========================================================
   CHECK DIRECT FLIGHT DATE
========================================================= */

function directFlightIsExactDate(
  flightResult,
  requestedDate
) {

  const possibleDates = [

    flightResult?.date,

    flightResult?.departure_airport?.date,

    flightResult?.departure_airport?.time,

    flightResult?.departure_airport?.scheduled_time,

    flightResult?.arrival_airport?.date,

    flightResult?.arrival_airport?.time,

    flightResult?.arrival_airport?.scheduled_time,

    flightResult?.metadata?.date

  ];


  return possibleDates.some(
    value =>
      normalizeDate(
        value
      ) ===
      requestedDate
  );

}


/* =========================================================
   FIND TOP LEVEL FLIGHT RESULT
========================================================= */

function getTopLevelFlightResult(
  data
) {

  /*
    THIS IS THE IMPORTANT FIX.

    SerpApi can return:

    {
      flight_result: {
        ...
      }
    }

    We check it FIRST.
  */

  if (
    data?.flight_result &&
    typeof data.flight_result ===
      "object"
  ) {

    return data.flight_result;

  }


  /*
    Some responses may place it
    inside another structure.
  */

  if (
    data?.data?.flight_result &&
    typeof data.data.flight_result ===
      "object"
  ) {

    return data.data.flight_result;

  }


  return null;

}


/* =========================================================
   FIND ANSWER BOX FLIGHT
========================================================= */

function getAnswerBoxFlight(
  data
) {

  const answer =
    data?.answer_box;


  if (!answer) {
    return null;
  }


  /*
    Single flight.
  */

  if (
    answer.type ===
      "flight_status" &&
    answer.flight_number
  ) {

    return answer;

  }


  /*
    Multiple flight statuses.
  */

  if (
    answer.type ===
      "flight_status" &&
    Array.isArray(
      answer.flights
    )
  ) {

    return answer.flights;

  }


  return null;

}


/* =========================================================
   FIND EXACT FLIGHT
========================================================= */

function findExactFlight(
  data,
  requestedFlight,
  requestedDate
) {

  /*
    =======================================================
    METHOD 1
    TOP LEVEL flight_result
    =======================================================
  */

  const topLevel =
    getTopLevelFlightResult(
      data
    );


  if (
    topLevel &&
    flightMatches(
      topLevel,
      requestedFlight
    )
  ) {

    /*
      First try dates[]
    */

    const exactRecord =
      findExactDateRecord(
        topLevel,
        requestedDate
      );


    if (exactRecord) {

      return {
        flightResult:
          topLevel,

        exactRecord:
          exactRecord
      };

    }


    /*
      Then try direct date.
    */

    if (
      directFlightIsExactDate(
        topLevel,
        requestedDate
      )
    ) {

      return {
        flightResult:
          topLevel,

        exactRecord:
          null
      };

    }

  }


  /*
    =======================================================
    METHOD 2
    ANSWER BOX
    =======================================================
  */

  const answer =
    getAnswerBoxFlight(
      data
    );


  if (answer) {

    /*
      Single answer box flight.
    */

    if (
      !Array.isArray(
        answer
      )
    ) {

      if (
        flightMatches(
          answer,
          requestedFlight
        )
      ) {

        /*
          Answer box usually gives
          the currently selected flight.

          If its date is unavailable,
          we still allow it when the
          date matches the requested
          date through departure.date.
        */

        const answerDate =
          normalizeDate(
            answer?.departure?.date
          );


        if (
          answerDate ===
          requestedDate
        ) {

          return {
            flightResult:
              convertAnswerBoxToFlight(
                answer
              ),

            exactRecord:
              null
          };

        }

      }

    }


    /*
      Multiple answer box flights.
    */

    if (
      Array.isArray(
        answer
      )
    ) {

      for (
        const flight
        of answer
      ) {

        if (
          !flightMatches(
            flight,
            requestedFlight
          )
        ) {
          continue;
        }


        const flightDate =
          normalizeDate(
            flight?.departure?.date
          );


        if (
          flightDate ===
          requestedDate
        ) {

          return {
            flightResult:
              convertAnswerBoxToFlight(
                flight
              ),

            exactRecord:
              null
          };

        }

      }

    }

  }


  return null;

}


/* =========================================================
   CONVERT ANSWER BOX
========================================================= */

function convertAnswerBoxToFlight(
  answer
) {

  const departure =
    answer?.departure || {};


  const arrival =
    answer?.arrival || {};


  return {

    title:
      answer.title ||
      answer.flight_number ||
      "",


    flight_designator:
      answer.flight_number ||
      "",


    route:
      answer.destination ||
      "",


    airline:
      answer.title ||
      "",


    flight_number:
      answer.flight_number ||
      "",


    status:
      answer.flight_status ||
      "Flight status",


    updated_label:
      answer.latest_update ||
      "",


    source:
      answer.sources?.[0]?.name ||
      "Google Flight Status",


    source_url:
      answer.sources?.[0]?.link ||
      "",


    departure_airport: {

      id:
        departure.airport_name ||
        "",

      city:
        departure.location ||
        "",

      time:
        departure.actual_time ||
        departure.planned_time ||
        "",

      time_label:
        departure.actual_time ||
        departure.planned_time ||
        "",

      scheduled_time:
        departure.planned_time ||
        "",

      terminal:
        departure.terminal ||
        "",

      gate:
        departure.gate ||
        "",

      date:
        departure.date ||
        ""

    },


    arrival_airport: {

      id:
        arrival.airport_name ||
        "",

      city:
        arrival.location ||
        "",

      time:
        arrival.actual_time ||
        arrival.planned_time ||
        "",

      time_label:
        arrival.actual_time ||
        arrival.planned_time ||
        "",

      scheduled_time:
        arrival.planned_time ||
        "",

      terminal:
        arrival.terminal ||
        "",

      gate:
        arrival.gate ||
        "",

      date:
        arrival.date ||
        ""

    }

  };

}


/* =========================================================
   BUILD EXACT RESPONSE
========================================================= */

function buildExactFlightResult(
  flightResult,
  exactRecord,
  requestedDate
) {

  const result = {};


  /*
    Top-level information.
  */

  const safeTopLevel = [

    "title",

    "flight_designator",

    "flight_number",

    "route",

    "airline",

    "airline_iata_code",

    "airline_logo",

    "logo",

    "aircraft",

    "duration",

    "duration_label",

    "source",

    "source_url",

    "codeshare",

    "updated_at",

    "updated_label",

    "status"

  ];


  for (
    const key
    of safeTopLevel
  ) {

    if (
      flightResult[key] !==
      undefined
    ) {

      result[key] =
        clone(
          flightResult[key]
        );

    }

  }


  /*
    Requested date.
  */

  result.date =
    requestedDate;


  /*
    EXACT DATE METADATA
  */

  if (
    exactRecord?.metadata
  ) {

    result.metadata =
      clone(
        exactRecord.metadata
      );

  } else if (
    flightResult?.metadata
  ) {

    result.metadata =
      clone(
        flightResult.metadata
      );

  } else {

    result.metadata =
      {};

  }


  /*
    EXACT DEPARTURE
  */

  if (
    exactRecord?.departure_airport
  ) {

    result.departure_airport =
      clone(
        exactRecord.departure_airport
      );

  } else if (
    flightResult?.departure_airport
  ) {

    result.departure_airport =
      clone(
        flightResult.departure_airport
      );

  }


  /*
    EXACT ARRIVAL
  */

  if (
    exactRecord?.arrival_airport
  ) {

    result.arrival_airport =
      clone(
        exactRecord.arrival_airport
      );

  } else if (
    flightResult?.arrival_airport
  ) {

    result.arrival_airport =
      clone(
        flightResult.arrival_airport
      );

  }


  /*
    Copy useful exact-date fields.
  */

  if (
    exactRecord
  ) {

    const excluded = [

      "date",

      "metadata",

      "departure_airport",

      "arrival_airport",

      "dates",

      "available_dates"

    ];


    for (
      const key
      of Object.keys(
        exactRecord
      )
    ) {

      if (
        excluded.includes(
          key
        )
      ) {
        continue;
      }


      if (
        result[key] ===
        undefined
      ) {

        result[key] =
          clone(
            exactRecord[key]
          );

      }

    }

  }


  /*
    =======================================================
    IMPORTANT:
    NEVER return all dates.
    =======================================================
  */

  delete result.dates;

  delete result.available_dates;


  return result;

}


/* =========================================================
   CLONE
========================================================= */

function clone(value) {

  if (
    value === undefined ||
    value === null
  ) {

    return value;

  }


  return JSON.parse(
    JSON.stringify(
      value
    )
  );

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
    OPTIONS
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
    ONLY GET
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


  try {

    /* =====================================================
       INPUT
    ===================================================== */

    const rawFlight =
      String(
        req.query.flight ||
        ""
      ).trim();


    const requestedDate =
      String(
        req.query.date ||
        ""
      ).trim();


    /* =====================================================
       VALIDATE FLIGHT
    ===================================================== */

    if (
      !rawFlight
    ) {

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


    /* =====================================================
       VALIDATE DATE
    ===================================================== */

    if (
      !requestedDate
    ) {

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


    /* =====================================================
       NORMALIZE
    ===================================================== */

    const normalizedFlight =
      normalizeFlight(
        rawFlight
      );


    if (
      !normalizedFlight
    ) {

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


    const displayName =
      displayFlight(
        rawFlight
      );


    /* =====================================================
       GOOGLE SEARCH QUERIES
    ===================================================== */

    const queries = [

      `"${displayName}" flight status ${requestedDate}`,

      `"${normalizedFlight}" flight status ${requestedDate}`,

      `${displayName} flight status ${requestedDate}`

    ];


    let matched =
      null;


    let lastResponse =
      null;


    /* =====================================================
       SEARCH
    ===================================================== */

    for (
      const query
      of queries
    ) {

      console.log(
        "Bokkara searching:",
        query
      );


      const data =
        await searchSerpApi(
          query
        );


      lastResponse =
        data;


      /*
        DEBUG INFORMATION IN VERCEL
        ONLY.
      */

      console.log(
        "SerpApi search status:",
        data?.search_metadata?.status
      );


      /*
        Look for exact flight.
      */

      matched =
        findExactFlight(
          data,
          normalizedFlight,
          requestedDate
        );


      if (
        matched
      ) {

        break;

      }

    }


    /* =====================================================
       NOT FOUND
    ===================================================== */

    if (
      !matched
    ) {

      console.log(
        "Bokkara flight not found:",
        {
          flight:
            normalizedFlight,

          date:
            requestedDate
        }
      );


      return sendJson(
        res,
        404,
        {
          success: false,

          error:
            `No exact flight status was found for ${displayName} on ${requestedDate}.`,

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


    /* =====================================================
       BUILD EXACT RESULT
    ===================================================== */

    const exactFlightResult =
      buildExactFlightResult(
        matched.flightResult,
        matched.exactRecord,
        requestedDate
      );


    /*
      FINAL SAFETY.
    */

    delete exactFlightResult.dates;

    delete exactFlightResult.available_dates;


    /* =====================================================
       RESPONSE
    ===================================================== */

    return sendJson(
      res,
      200,
      {

        success:
          true,

        query: {

          flight:
            rawFlight,

          normalized_flight:
            normalizedFlight,

          date:
            requestedDate

        },

        flight_result:
          exactFlightResult

      }
    );


  } catch (
    error
  ) {

    console.error(
      "Bokkara Airline Search Error:",
      error
    );


    if (
      error?.name ===
      "AbortError"
    ) {

      return sendJson(
        res,
        504,
        {
          success: false,

          error:
            "The flight search timed out. Please try again."
        }
      );

    }


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
