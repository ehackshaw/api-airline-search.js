/**
 * =========================================================
 * BOKKARA AIRLINE SEARCH API
 * EXACT FLIGHT STATUS
 * =========================================================
 *
 * Endpoint:
 *
 * /api/airline-search?flight=B6117&date=2026-09-08
 *
 * Also accepts:
 *
 * /api/airline-search?flight=B6%20117&date=2026-09-08
 *
 * Powered by:
 * SerpApi -> Google Search
 *
 * Returns ONLY the requested flight/date.
 * =========================================================
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
   NORMALIZE FLIGHT NUMBER
   ========================================================= */

function normalizeFlight(value) {

  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .trim();

}


/* =========================================================
   DISPLAY FLIGHT NUMBER
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
    normalized.match(
      /^([A-Z0-9]{2,3})(\d+)$/
    );

  if (!match) {

    return String(value || "")
      .trim()
      .toUpperCase();

  }

  return `${match[1]} ${match[2]}`;

}


/* =========================================================
   DATE VALIDATION
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
   DATE NORMALIZATION
   ========================================================= */

function normalizeDate(value) {

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
   YYYY-MM-DD HH:mm
  */

  const datetime =
    string.match(
      /^(\d{4})-(\d{2})-(\d{2})\s/
    );

  if (datetime) {

    return (
      `${datetime[1]}-${datetime[2]}-${datetime[3]}`
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
   Try normal Date parsing
  */

  const parsed =
    new Date(string);

  if (
    !isNaN(
      parsed.getTime()
    )
  ) {

    return (
      `${parsed.getUTCFullYear()}-` +
      `${String(
        parsed.getUTCMonth() + 1
      ).padStart(2, "0")}-` +
      `${String(
        parsed.getUTCDate()
      ).padStart(2, "0")}`
    );

  }


  return null;

}


/* =========================================================
   FETCH WITH TIMEOUT
   ========================================================= */

async function fetchWithTimeout(url) {

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
   SERPAPI GOOGLE SEARCH
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

  } catch (error) {

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
   NORMALIZE STRING
   ========================================================= */

function cleanString(value) {

  if (
    value === null ||
    value === undefined
  ) {

    return null;

  }

  const result =
    String(value)
      .trim();

  return result || null;

}


/* =========================================================
   GET FIRST VALUE
   ========================================================= */

function firstValue(...values) {

  for (
    const value
    of values
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
   EXTRACT FLIGHT NUMBER FROM TEXT
   ========================================================= */

function extractFlightNumber(value) {

  const normalized =
    normalizeFlight(value);

  if (!normalized) {
    return null;
  }


  /*
   Find something like:

   B6117
   BW601
   EK181
   IB5634
  */

  const match =
    normalized.match(
      /([A-Z0-9]{2,3}\d{1,5})/
    );

  if (!match) {
    return null;
  }

  return match[1];

}


/* =========================================================
   FLIGHT NUMBER MATCH
   ========================================================= */

function flightMatches(
  candidate,
  requestedFlight
) {

  const requested =
    normalizeFlight(
      requestedFlight
    );

  if (!requested) {
    return false;
  }


  const candidateNormalized =
    normalizeFlight(
      candidate
    );


  if (!candidateNormalized) {
    return false;
  }


  /*
   Exact
  */

  if (
    candidateNormalized === requested
  ) {

    return true;

  }


  /*
   Candidate contains requested
  */

  if (
    candidateNormalized.includes(
      requested
    )
  ) {

    return true;

  }


  /*
   Requested contains candidate
  */

  if (
    requested.includes(
      candidateNormalized
    )
  ) {

    return true;

  }


  /*
   Extract flight number
  */

  const extracted =
    extractFlightNumber(
      candidateNormalized
    );


  if (
    extracted === requested
  ) {

    return true;

  }


  return false;

}


/* =========================================================
   FIND OBJECTS RECURSIVELY
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


  if (
    visited.has(value)
  ) {

    return results;

  }


  visited.add(value);


  if (
    callback(value)
  ) {

    results.push(value);

  }


  if (
    Array.isArray(value)
  ) {

    for (
      const item
      of value
    ) {

      findObjects(
        item,
        callback,
        results,
        visited
      );

    }

  } else {

    for (
      const key
      of Object.keys(value)
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
   FIND GOOGLE FLIGHT STATUS ANSWER BOX
   ========================================================= */

function findFlightStatusAnswerBox(
  data,
  requestedFlight
) {

  const requested =
    normalizeFlight(
      requestedFlight
    );


  /*
   First check normal Google
   answer_box.
  */

  const answerBox =
    data?.answer_box;


  if (
    answerBox &&
    answerBox.type === "flight_status"
  ) {

    const candidates = [

      answerBox.flight_number,

      answerBox.flight_designator,

      answerBox.title

    ];


    if (
      candidates.some(
        value =>
          flightMatches(
            value,
            requested
          )
      )
    ) {

      return answerBox;

    }


    /*
     Some Google responses have
     multiple flights.
    */

    if (
      Array.isArray(
        answerBox.flights
      )
    ) {

      const match =
        answerBox.flights.find(
          flight =>
            flightMatches(
              flight?.flight_number,
              requested
            )
        );


      if (match) {

        return {
          ...answerBox,
          ...match
        };

      }

    }

  }


  /*
   Search recursively for another
   flight_status answer object.
  */

  const objects =
    findObjects(
      data,
      object => {

        return (
          object?.type ===
          "flight_status"
        );

      }
    );


  for (
    const object
    of objects
  ) {

    const candidates = [

      object.flight_number,

      object.flight_designator,

      object.title

    ];


    if (
      candidates.some(
        value =>
          flightMatches(
            value,
            requested
          )
      )
    ) {

      return object;

    }

  }


  return null;

}


/* =========================================================
   FIND SERPAPI FLIGHT RESULT
   ========================================================= */

function findFlightResult(
  data,
  requestedFlight
) {

  const requested =
    normalizeFlight(
      requestedFlight
    );


  /*
   SerpApi documented
   flight_result format.
  */

  const direct =
    data?.flight_result;


  if (
    direct
  ) {

    const candidates = [

      direct.flight_designator,

      direct.flight_number,

      direct.title,

      direct.codeshare,

      direct.metadata?.flight_number,

      direct.metadata?.flight_designator

    ];


    if (
      candidates.some(
        value =>
          flightMatches(
            value,
            requested
          )
      )
    ) {

      return direct;

    }

  }


  /*
   Search recursively.
  */

  const objects =
    findObjects(
      data,
      object => {

        return (
          object?.flight_designator ||
          object?.flight_number ||
          object?.title
        ) && (
          object?.dates ||
          object?.departure_airport ||
          object?.arrival_airport
        );

      }
    );


  for (
    const object
    of objects
  ) {

    const candidates = [

      object.flight_designator,

      object.flight_number,

      object.title,

      object.codeshare,

      object.metadata?.flight_number,

      object.metadata?.flight_designator

    ];


    if (
      candidates.some(
        value =>
          flightMatches(
            value,
            requested
          )
      )
    ) {

      return object;

    }

  }


  return null;

}


/* =========================================================
   CHECK ANSWER BOX DATE
   ========================================================= */

function answerBoxMatchesDate(
  answerBox,
  requestedDate
) {

  if (!answerBox) {
    return false;
  }


  const possibleDates = [

    answerBox.date,

    answerBox.departure?.date,

    answerBox.arrival?.date,

    answerBox.departure?.planned_time,

    answerBox.departure?.actual_time,

    answerBox.arrival?.planned_time,

    answerBox.arrival?.actual_time,

    answerBox.latest_update,

    answerBox.updated_at

  ];


  /*
   If Google gives no machine-readable
   date, don't reject the flight.

   The Google flight-status block itself
   is already the result for the queried
   flight.
  */

  const normalizedDates =
    possibleDates
      .map(normalizeDate)
      .filter(Boolean);


  if (
    normalizedDates.length === 0
  ) {

    return true;

  }


  return normalizedDates.includes(
    requestedDate
  );

}


/* =========================================================
   GET AIRPORT CODE
   ========================================================= */

function airportCode(
  airport
) {

  if (!airport) {
    return null;
  }


  if (
    typeof airport === "string"
  ) {

    const match =
      airport.match(
        /\b([A-Z]{3})\b/
      );

    return match
      ? match[1]
      : null;

  }


  return cleanString(
    firstValue(

      airport.airport_name,

      airport.airport_code,

      airport.code,

      airport.iata,

      airport.id,

      airport.airport_id,

      airport.name

    )
  );

}


/* =========================================================
   GET AIRPORT LOCATION
   ========================================================= */

function airportLocation(
  airport
) {

  if (!airport) {
    return null;
  }


  if (
    typeof airport === "string"
  ) {

    const match =
      airport.match(
        /^(.+?)\s*\(([A-Z]{3})\)/
      );


    if (match) {

      return match[1]
        .replace(
          /International Airport$/i,
          ""
        )
        .trim();

    }


    return airport
      .replace(
        / International Airport$/i,
        ""
      )
      .trim();

  }


  return cleanString(
    firstValue(

      airport.location,

      airport.city,

      airport.city_name,

      airport.airport_city,

      airport.name,

      airport.airport_name

    )
  );

}


/* =========================================================
   BUILD STATUS FROM GOOGLE ANSWER BOX
   ========================================================= */

function buildFromAnswerBox(
  answerBox,
  requestedDate
) {

  const departure =
    answerBox?.departure || {};


  const arrival =
    answerBox?.arrival || {};


  const sources =
    Array.isArray(
      answerBox?.sources
    )
      ? answerBox.sources
      : [];


  const primarySource =
    sources[0] || {};


  const flightNumber =
    cleanString(
      firstValue(

        answerBox.flight_number,

        answerBox.flight_designator,

        answerBox.title

      )
    );


  const title =
    cleanString(
      firstValue(
        answerBox.title,
        flightNumber
      )
    );


  const destination =
    cleanString(
      answerBox.destination
    );


  /*
   Google uses:

   destination:
   "Munich to Houston"

   We do not need to parse this
   if explicit departure/arrival
   objects are available.
  */

  const departureCode =
    cleanString(
      firstValue(

        departure.airport_name,

        departure.airport_code,

        departure.code

      )
    );


  const arrivalCode =
    cleanString(
      firstValue(

        arrival.airport_name,

        arrival.airport_code,

        arrival.code

      )
    );


  const departureLocation =
    cleanString(
      firstValue(
        departure.location,
        departure.city
      )
    );


  const arrivalLocation =
    cleanString(
      firstValue(
        arrival.location,
        arrival.city
      )
    );


  const departureDate =
    cleanString(
      firstValue(
        departure.date,
        requestedDate
      )
    );


  const arrivalDate =
    cleanString(
      firstValue(
        arrival.date,
        requestedDate
      )
    );


  return {

    title,

    flight_number:
      flightNumber,

    flight_designator:
      flightNumber,

    route:
      destination,

    airline:
      cleanString(
        answerBox.airline
      ),

    status:
      cleanString(
        firstValue(
          answerBox.flight_status,
          answerBox.status
        )
      ),

    updated_label:
      cleanString(
        firstValue(
          answerBox.latest_update,
          answerBox.updated_label
        )
      ),

    source:
      cleanString(
        primarySource.name
      ),

    source_url:
      cleanString(
        primarySource.link
      ),

    date:
      requestedDate,

    departure: {

      airport_code:
        departureCode,

      location:
        departureLocation,

      date:
        departureDate,

      planned_time:
        cleanString(
          departure.planned_time
        ),

      actual_time:
        cleanString(
          departure.actual_time
        ),

      terminal:
        cleanString(
          departure.terminal
        ),

      gate:
        cleanString(
          departure.gate
        )

    },

    arrival: {

      airport_code:
        arrivalCode,

      location:
        arrivalLocation,

      date:
        arrivalDate,

      planned_time:
        cleanString(
          arrival.planned_time
        ),

      actual_time:
        cleanString(
          arrival.actual_time
        ),

      terminal:
        cleanString(
          arrival.terminal
        ),

      gate:
        cleanString(
          arrival.gate
        )

    }

  };

}


/* =========================================================
   BUILD STATUS FROM FLIGHT RESULT
   ========================================================= */

function buildFromFlightResult(
  flightResult,
  exactRecord,
  requestedDate
) {

  const source =
    exactRecord || flightResult;


  const metadata =
    source?.metadata ||
    flightResult?.metadata ||
    {};


  const departure =
    source?.departure_airport ||
    flightResult?.departure_airport ||
    {};


  const arrival =
    source?.arrival_airport ||
    flightResult?.arrival_airport ||
    {};


  const sourceList =
    Array.isArray(
      source?.sources
    )
      ? source.sources
      : [];


  const primarySource =
    sourceList[0] || {};


  return {

    title:
      cleanString(
        firstValue(
          flightResult.title,
          flightResult.flight_designator,
          flightResult.flight_number
        )
      ),

    flight_number:
      cleanString(
        firstValue(
          metadata.flight_number,
          flightResult.flight_number,
          flightResult.flight_designator
        )
      ),

    flight_designator:
      cleanString(
        firstValue(
          flightResult.flight_designator,
          flightResult.flight_number
        )
      ),

    route:
      cleanString(
        flightResult.route
      ),

    airline:
      cleanString(
        firstValue(
          flightResult.airline,
          metadata.airline
        )
      ),

    airline_iata_code:
      cleanString(
        firstValue(
          flightResult.airline_iata_code,
          metadata.airline_iata_code
        )
      ),

    airline_logo:
      cleanString(
        firstValue(
          flightResult.airline_logo,
          flightResult.logo
        )
      ),

    status:
      cleanString(
        firstValue(
          source.status,
          metadata.status,
          flightResult.status
        )
      ),

    updated_label:
      cleanString(
        firstValue(
          source.updated_label,
          flightResult.updated_label,
          flightResult.updated_at
        )
      ),

    source:
      cleanString(
        firstValue(
          source.source,
          flightResult.source,
          primarySource.name
        )
      ),

    source_url:
      cleanString(
        firstValue(
          source.source_url,
          flightResult.source_url,
          primarySource.link
        )
      ),

    date:
      requestedDate,

    departure: {

      airport_code:
        cleanString(
          firstValue(
            departure.id,
            departure.airport_id,
            departure.code,
            departure.iata,
            metadata.origin
          )
        ),

      location:
        cleanString(
          firstValue(
            departure.location,
            departure.city,
            departure.city_name,
            departure.name,
            metadata.origin
          )
        ),

      date:
        requestedDate,

      planned_time:
        cleanString(
          firstValue(
            source.scheduled_departure,
            source.departure?.planned_time,
            departure.scheduled_time,
            departure.time
          )
        ),

      actual_time:
        cleanString(
          firstValue(
            source.actual_departure,
            source.departure?.actual_time,
            departure.actual_time
          )
        ),

      terminal:
        cleanString(
          firstValue(
            source.departure_terminal,
            source.departure?.terminal,
            departure.terminal
          )
        ),

      gate:
        cleanString(
          firstValue(
            source.departure_gate,
            source.departure?.gate,
            departure.gate
          )
        )

    },

    arrival: {

      airport_code:
        cleanString(
          firstValue(
            arrival.id,
            arrival.airport_id,
            arrival.code,
            arrival.iata,
            metadata.destination
          )
        ),

      location:
        cleanString(
          firstValue(
            arrival.location,
            arrival.city,
            arrival.city_name,
            arrival.name,
            metadata.destination
          )
        ),

      date:
        requestedDate,

      planned_time:
        cleanString(
          firstValue(
            source.scheduled_arrival,
            source.arrival?.planned_time,
            arrival.scheduled_time,
            arrival.time
          )
        ),

      actual_time:
        cleanString(
          firstValue(
            source.actual_arrival,
            source.arrival?.actual_time,
            arrival.actual_time
          )
        ),

      terminal:
        cleanString(
          firstValue(
            source.arrival_terminal,
            source.arrival?.terminal,
            arrival.terminal
          )
        ),

      gate:
        cleanString(
          firstValue(
            source.arrival_gate,
            source.arrival?.gate,
            arrival.gate
          )
        )

    }

  };

}


/* =========================================================
   EXACT DATE RECORD
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


  return (
    flightResult.dates.find(
      item => {

        return (
          normalizeDate(
            item?.date
          ) === requestedDate
        );

      }
    ) || null
  );

}


/* =========================================================
   MAIN SEARCH
   ========================================================= */

async function findFlightStatus(
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
   IMPORTANT:

   These queries intentionally focus
   on the exact flight number and
   requested date.

   Google Search produces the
   flight-status answer box.
  */

  const queries = [

    `"${displayName}" flight status ${requestedDate}`,

    `"${normalizedFlight}" flight status ${requestedDate}`,

    `${displayName} flight status ${requestedDate}`

  ];


  let lastData =
    null;


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


    /*
     -----------------------------------------
     1. GOOGLE FLIGHT STATUS ANSWER BOX
     -----------------------------------------
    */

    const answerBox =
      findFlightStatusAnswerBox(
        data,
        normalizedFlight
      );


    if (
      answerBox
    ) {

      /*
       Verify date if Google gave
       us a machine-readable date.
      */

      if (
        answerBoxMatchesDate(
          answerBox,
          requestedDate
        )
      ) {

        return {

          type:
            "flight_status",

          data:
            buildFromAnswerBox(
              answerBox,
              requestedDate
            )

        };

      }

    }


    /*
     -----------------------------------------
     2. SERPAPI FLIGHT RESULT
     -----------------------------------------
    */

    const flightResult =
      findFlightResult(
        data,
        normalizedFlight
      );


    if (
      flightResult
    ) {

      const exactRecord =
        findExactDateRecord(
          flightResult,
          requestedDate
        );


      /*
       If dates[] exists, require
       exact requested date.
      */

      if (
        Array.isArray(
          flightResult.dates
        ) &&
        flightResult.dates.length > 0
      ) {

        if (
          exactRecord
        ) {

          return {

            type:
              "flight_result",

            data:
              buildFromFlightResult(
                flightResult,
                exactRecord,
                requestedDate
              )

          };

        }

      } else {

        /*
         No dates[] means Google has
         returned the selected flight
         directly.
        */

        return {

          type:
            "flight_result",

          data:
            buildFromFlightResult(
              flightResult,
              null,
              requestedDate
            )

        };

      }

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
     FLIGHT REQUIRED
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


    /*
     -----------------------------------------
     DATE REQUIRED
     -----------------------------------------
    */

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


    /*
     -----------------------------------------
     VALID DATE
     -----------------------------------------
    */

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


    /*
     -----------------------------------------
     NORMALIZE FLIGHT
     -----------------------------------------
    */

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

    const result =
      await findFlightStatus(
        normalizedFlight,
        requestedDate
      );


    /*
     -----------------------------------------
     NOTHING FOUND
     -----------------------------------------
    */

    if (!result) {

      return sendJson(
        res,
        404,
        {
          success: false,

          error:
            `No exact flight status was found for ${displayFlight(normalizedFlight)} on ${requestedDate}.`,

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
     -----------------------------------------
     FINAL RESPONSE
     -----------------------------------------
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

        result_type:
          result.type,

        flight:
          result.data

      }
    );


  } catch (error) {

    console.error(
      "Bokkara Airline Search Error:",
      error
    );


    /*
     -----------------------------------------
     SERVER ERROR
     -----------------------------------------
    */

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
