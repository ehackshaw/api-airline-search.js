/**
 * BOKKARA AIRLINE SEARCH API
 * Vercel Serverless Function
 *
 * Endpoint:
 * /api/airline-search?flight=B6%20117&date=2026-09-07
 *
 * Returns ONLY the requested flight/date.
 */

const SERPAPI_URL = "https://serpapi.com/search.json";
const REQUEST_TIMEOUT_MS = 25000;


/* =========================================================
   CORS
   ========================================================= */

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
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

function sendJson(res, status, body) {
  setCors(res);

  res.status(status).json(body);
}


/* =========================================================
   DATE VALIDATION
   ========================================================= */

function isValidDate(value) {

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);

  return (
    !isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
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
   FLIGHT DISPLAY FORMAT
   ========================================================= */

function displayFlight(value) {

  const normalized =
    normalizeFlight(value);

  /*
   Examples:

   B6117
   -> B6 117

   BW601
   -> BW 601

   IB5634
   -> IB 5634
  */

  const match =
    normalized.match(/^([A-Z]{2,3})(\d+)$/);

  if (!match) {
    return String(value || "").trim();
  }

  return `${match[1]} ${match[2]}`;

}


/* =========================================================
   FETCH WITH TIMEOUT
   ========================================================= */

async function fetchWithTimeout(url) {

  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS
    );

  try {

    const response =
      await fetch(
        url,
        {
          method: "GET",
          signal: controller.signal,
          headers: {
            Accept: "application/json"
          }
        }
      );

    return response;

  } finally {

    clearTimeout(timeout);

  }

}


/* =========================================================
   SERPAPI SEARCH
   ========================================================= */

async function searchSerpApi(query) {

  const apiKey =
    process.env.SERPAPI_KEY;

  if (!apiKey) {
    throw new Error(
      "SERPAPI_KEY is not configured."
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
      JSON.parse(text);

  } catch (error) {

    throw new Error(
      "SerpApi returned an invalid response."
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
   DATE NORMALIZATION
   ========================================================= */

function normalizeDate(value) {

  if (!value) {
    return null;
  }

  const string =
    String(value).trim();


  /*
   Exact YYYY-MM-DD
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
   Try JavaScript date parsing
  */

  const parsed =
    new Date(string);

  if (!isNaN(parsed.getTime())) {

    const year =
      parsed.getUTCFullYear();

    const month =
      String(
        parsed.getUTCMonth() + 1
      ).padStart(2, "0");

    const day =
      String(
        parsed.getUTCDate()
      ).padStart(2, "0");

    return `${year}-${month}-${day}`;

  }


  return null;

}


/* =========================================================
   RECURSIVE OBJECT WALKER
   ========================================================= */

function findObjects(
  value,
  callback,
  results = [],
  visited = new Set()
) {

  if (
    value === null ||
    value === undefined
  ) {
    return results;
  }


  if (
    typeof value !== "object"
  ) {
    return results;
  }


  if (visited.has(value)) {
    return results;
  }

  visited.add(value);


  if (callback(value)) {
    results.push(value);
  }


  if (Array.isArray(value)) {

    for (const item of value) {

      findObjects(
        item,
        callback,
        results,
        visited
      );

    }

  } else {

    for (
      const key of Object.keys(value)
    ) {

      findObjects(
        value[key],
        callback,
        results,
        visited
      );

    }

  }


  return results;

}


/* =========================================================
   FIND FLIGHT RESULT OBJECTS
   ========================================================= */

function findFlightResults(data) {

  return findObjects(
    data,
    object => {

      if (
        !object ||
        typeof object !== "object"
      ) {
        return false;
      }

      return (
        object.flight_designator ||
        object.title ||
        object.route
      ) && (
        object.dates ||
        object.departure_airport ||
        object.arrival_airport ||
        object.metadata
      );

    }
  );

}


/* =========================================================
   FLIGHT NUMBER MATCH
   ========================================================= */

function flightMatches(
  flightResult,
  requestedFlight
) {

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
    flightResult.title,
    flightResult.codeshare,
    flightResult.metadata?.flight_number,
    flightResult.metadata?.flight_designator
  ];


  for (
    const candidate of candidates
  ) {

    const normalized =
      normalizeFlight(candidate);

    if (!normalized) {
      continue;
    }


    /*
     Direct match
    */

    if (normalized === requested) {
      return true;
    }


    /*
     Candidate may contain airline name:

     "JetBlue B6 117"
    */

    if (
      normalized.includes(requested) ||
      requested.includes(normalized)
    ) {

      return true;

    }

  }


  return false;

}


/* =========================================================
   FIND EXACT DATE RECORD
   ========================================================= */

function findExactDateRecord(
  flightResult,
  requestedDate
) {

  if (
    !Array.isArray(
      flightResult.dates
    )
  ) {
    return null;
  }


  for (
    const item of flightResult.dates
  ) {

    if (!item) {
      continue;
    }


    const itemDate =
      normalizeDate(
        item.date
      );


    if (
      itemDate === requestedDate
    ) {

      return item;

    }

  }


  return null;

}


/* =========================================================
   CHECK DIRECT FLIGHT RESULT DATE
   ========================================================= */

function directFlightIsExactDate(
  flightResult,
  requestedDate
) {

  const possibleDates = [

    flightResult.date,

    flightResult.departure_airport?.date,

    flightResult.departure_airport?.time,

    flightResult.departure_airport?.scheduled_time,

    flightResult.arrival_airport?.time,

    flightResult.arrival_airport?.scheduled_time,

    flightResult.metadata?.date

  ];


  return possibleDates.some(
    value =>
      normalizeDate(value) === requestedDate
  );

}


/* =========================================================
   FIND BEST EXACT FLIGHT
   ========================================================= */

function findExactFlight(
  data,
  requestedFlight,
  requestedDate
) {

  const flightResults =
    findFlightResults(data);


  /*
   FIRST:
   Look for a flight_result with dates[]
   and an exact requested date.
  */

  for (
    const flightResult
    of flightResults
  ) {

    if (
      !flightMatches(
        flightResult,
        requestedFlight
      )
    ) {
      continue;
    }


    const exactRecord =
      findExactDateRecord(
        flightResult,
        requestedDate
      );


    if (
      exactRecord
    ) {

      return {
        flightResult,
        exactRecord
      };

    }

  }


  /*
   SECOND:
   Some Google results return the
   selected date directly instead
   of using dates[].
  */

  for (
    const flightResult
    of flightResults
  ) {

    if (
      !flightMatches(
        flightResult,
        requestedFlight
      )
    ) {
      continue;
    }


    if (
      directFlightIsExactDate(
        flightResult,
        requestedDate
      )
    ) {

      return {
        flightResult,
        exactRecord: null
      };

    }

  }


  return null;

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
    JSON.stringify(value)
  );

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
   Copy top-level information.
  */

  const safeTopLevel = [
    "title",
    "flight_designator",
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
    const key of safeTopLevel
  ) {

    if (
      flightResult[key] !== undefined
    ) {

      result[key] =
        clone(
          flightResult[key]
        );

    }

  }


  /*
   Exact requested date.
  */

  result.date =
    requestedDate;


  /*
   Exact date metadata.
  */

  if (
    exactRecord &&
    exactRecord.metadata
  ) {

    result.metadata =
      clone(
        exactRecord.metadata
      );

  } else if (
    flightResult.metadata
  ) {

    result.metadata =
      clone(
        flightResult.metadata
      );

  } else {

    result.metadata = {};

  }


  /*
   Exact date airport data.
  */

  if (
    exactRecord &&
    exactRecord.departure_airport
  ) {

    result.departure_airport =
      clone(
        exactRecord.departure_airport
      );

  } else if (
    flightResult.departure_airport
  ) {

    result.departure_airport =
      clone(
        flightResult.departure_airport
      );

  }


  if (
    exactRecord &&
    exactRecord.arrival_airport
  ) {

    result.arrival_airport =
      clone(
        exactRecord.arrival_airport
      );

  } else if (
    flightResult.arrival_airport
  ) {

    result.arrival_airport =
      clone(
        flightResult.arrival_airport
      );

  }


  /*
   Preserve other useful fields
   from the exact date record.
  */

  if (exactRecord) {

    const excluded = [
      "date",
      "metadata",
      "departure_airport",
      "arrival_airport",
      "dates",
      "available_dates"
    ];


    for (
      const key of Object.keys(
        exactRecord
      )
    ) {

      if (
        excluded.includes(key)
      ) {
        continue;
      }


      if (
        result[key] === undefined
      ) {

        result[key] =
          clone(
            exactRecord[key]
          );

      }

    }

  }


  /*
   Never return dates[].
   Never return available_dates.
  */

  delete result.dates;
  delete result.available_dates;


  return result;

}


/* =========================================================
   MAIN HANDLER
   ========================================================= */

export default async function handler(
  req,
  res
) {

  setCors(res);


  if (
    req.method === "OPTIONS"
  ) {

    return res
      .status(204)
      .end();

  }


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

    const rawFlight =
      String(
        req.query.flight || ""
      ).trim();


    const requestedDate =
      String(
        req.query.date || ""
      ).trim();


    /*
     Required parameters
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


    const displayName =
      displayFlight(
        rawFlight
      );


    /*
     Use several Google-friendly
     search formats.
    */

    const queries = [
      `"${displayName}" flight status ${requestedDate}`,
      `"${normalizedFlight}" flight status ${requestedDate}`,
      `${displayName} flight status ${requestedDate}`
    ];


    let matched = null;

    let lastData = null;


    /*
     Search until we find the
     exact flight AND exact date.
    */

    for (
      const query
      of queries
    ) {

      const data =
        await searchSerpApi(
          query
        );


      lastData =
        data;


      matched =
        findExactFlight(
          data,
          normalizedFlight,
          requestedDate
        );


      if (matched) {
        break;
      }

    }


    /*
     Nothing found.
    */

    if (!matched) {

      return sendJson(
        res,
        404,
        {
          success: false,
          error:
            `No exact flight status was found for ${displayName} on ${requestedDate}.`,
          query: {
            flight: rawFlight,
            normalized_flight:
              normalizedFlight,
            date: requestedDate
          }
        }
      );

    }


    const exactFlightResult =
      buildExactFlightResult(
        matched.flightResult,
        matched.exactRecord,
        requestedDate
      );


    /*
     FINAL SAFETY:
     Make absolutely sure no date
     arrays leak through.
    */

    delete exactFlightResult.dates;
    delete exactFlightResult.available_dates;


    return sendJson(
      res,
      200,
      {
        success: true,

        query: {
          flight: rawFlight,
          normalized_flight:
            normalizedFlight,
          date: requestedDate
        },

        flight_result:
          exactFlightResult
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
          error.message ||
          "Unable to retrieve flight information."
      }
    );

  }

}
