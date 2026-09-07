/**
 * =========================================================
 * BOKKARA AIRLINE SEARCH API
 * VERCEL SERVERLESS FUNCTION
 * =========================================================
 *
 * GET:
 * /api/airline-search?flight=B6%20117&date=2026-09-07
 *
 * Returns ONLY the requested flight and requested date.
 * =========================================================
 */

const SERPAPI_URL = "https://serpapi.com/search.json";
const REQUEST_TIMEOUT_MS = 30000;


/* =========================================================
   CORS
========================================================= */

function cors(res) {
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
   RESPONSE
========================================================= */

function response(res, status, data) {
  cors(res);
  return res.status(status).json(data);
}


/* =========================================================
   FLIGHT NORMALIZATION
========================================================= */

function normalizeFlight(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}


function displayFlight(value) {
  const normalized = normalizeFlight(value);

  const match = normalized.match(
    /^([A-Z]{2,3})(\d+)$/
  );

  if (!match) {
    return String(value || "").trim();
  }

  return `${match[1]} ${match[2]}`;
}


/* =========================================================
   DATE VALIDATION
========================================================= */

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const d = new Date(`${value}T00:00:00Z`);

  return (
    !Number.isNaN(d.getTime()) &&
    d.toISOString().slice(0, 10) === value
  );
}


/* =========================================================
   FETCH
========================================================= */

async function fetchWithTimeout(url) {

  const controller = new AbortController();

  const timer = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS
  );

  try {

    return await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json"
      },
      signal: controller.signal
    });

  } finally {

    clearTimeout(timer);

  }
}


/* =========================================================
   SERPAPI
========================================================= */

async function serpapiSearch(query) {

  if (!process.env.SERPAPI_KEY) {
    throw new Error(
      "SERPAPI_KEY is missing from Vercel environment variables."
    );
  }

  const url = new URL(SERPAPI_URL);

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
    process.env.SERPAPI_KEY
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

  const result = await fetchWithTimeout(
    url.toString()
  );

  const text = await result.text();

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      "SerpAPI did not return valid JSON."
    );
  }

  if (!result.ok) {
    throw new Error(
      data?.error ||
      `SerpAPI HTTP ${result.status}`
    );
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
}


/* =========================================================
   FIND FLIGHT RESULT
========================================================= */

function getFlightResult(data) {

  /*
   * This is the important part.
   *
   * SerpAPI's Google flight-number search returns:
   *
   * {
   *   flight_result: {
   *      flight_designator: "...",
   *      dates: [...]
   *   }
   * }
   */

  if (
    data &&
    data.flight_result &&
    typeof data.flight_result === "object"
  ) {
    return data.flight_result;
  }

  /*
   * Some responses may be wrapped in data.
   */

  if (
    data?.data?.flight_result &&
    typeof data.data.flight_result === "object"
  ) {
    return data.data.flight_result;
  }

  return null;
}


/* =========================================================
   FLIGHT NUMBER MATCH
========================================================= */

function flightMatches(
  flightResult,
  requestedFlight
) {

  const requested =
    normalizeFlight(requestedFlight);

  const possible = [

    flightResult?.flight_designator,

    flightResult?.flight_number,

    flightResult?.title,

    flightResult?.metadata?.flight_number,

    flightResult?.metadata?.flight_designator

  ];

  return possible.some(value => {

    const candidate =
      normalizeFlight(value);

    if (!candidate) {
      return false;
    }

    return (
      candidate === requested ||
      candidate.includes(requested) ||
      requested.includes(candidate)
    );

  });
}


/* =========================================================
   FIND REQUESTED DATE
========================================================= */

function findDate(
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
      item =>
        String(item?.date || "")
          .slice(0, 10) === requestedDate
    ) || null
  );
}


/* =========================================================
   ANSWER BOX FALLBACK
========================================================= */

function answerBoxResult(
  data,
  requestedFlight,
  requestedDate
) {

  const answer =
    data?.answer_box;

  if (!answer) {
    return null;
  }

  const answerFlight =
    normalizeFlight(
      answer.flight_number
    );

  const requested =
    normalizeFlight(
      requestedFlight
    );

  if (
    !answerFlight ||
    !(
      answerFlight === requested ||
      answerFlight.includes(requested) ||
      requested.includes(answerFlight)
    )
  ) {
    return null;
  }

  /*
   * Google's answer box sometimes doesn't provide
   * an ISO date. We therefore only use this fallback
   * when it explicitly contains the requested date.
   */

  const rawText =
    JSON.stringify(answer);

  if (
    !rawText.includes(requestedDate)
  ) {
    return null;
  }

  return {
    title:
      answer.title ||
      displayFlight(requestedFlight),

    flight_designator:
      answer.flight_number ||
      displayFlight(requestedFlight),

    flight_number:
      answer.flight_number ||
      displayFlight(requestedFlight),

    status:
      answer.flight_status ||
      "Flight status",

    updated_label:
      answer.latest_update ||
      "",

    departure_airport:
      answer.departure || {},

    arrival_airport:
      answer.arrival || {},

    date:
      requestedDate
  };
}


/* =========================================================
   BUILD RESULT
========================================================= */

function buildResult(
  flightResult,
  dateRecord,
  requestedDate
) {

  const result = {

    title:
      flightResult?.title ||
      flightResult?.flight_designator ||
      "",

    flight_designator:
      flightResult?.flight_designator ||
      "",

    flight_number:
      dateRecord?.metadata?.flight_number ||
      flightResult?.flight_designator ||
      "",

    airline:
      flightResult?.airline ||
      "",

    airline_iata_code:
      flightResult?.airline_iata_code ||
      dateRecord?.metadata?.airline_iata_code ||
      "",

    route:
      flightResult?.route ||
      "",

    date:
      requestedDate,

    status:
      dateRecord?.status ||
      dateRecord?.metadata?.status ||
      "Scheduled",

    duration:
      dateRecord?.duration ||
      null,

    duration_label:
      dateRecord?.duration_label ||
      "",

    source:
      dateRecord?.source ||
      "",

    source_url:
      dateRecord?.source_url ||
      "",

    codeshare:
      dateRecord?.codeshare ||
      "",

    updated_at:
      dateRecord?.updated_at ||
      "",

    updated_label:
      dateRecord?.updated_label ||
      "",

    metadata:
      dateRecord?.metadata ||
      {},

    departure_airport:
      dateRecord?.departure_airport ||
      null,

    arrival_airport:
      dateRecord?.arrival_airport ||
      null

  };

  return result;
}


/* =========================================================
   MAIN
========================================================= */

export default async function handler(
  req,
  res
) {

  cors(res);

  /*
   * OPTIONS
   */

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }


  /*
   * GET ONLY
   */

  if (req.method !== "GET") {

    return response(
      res,
      405,
      {
        success: false,
        error: "GET requests only."
      }
    );

  }


  try {

    /* =====================================================
       PARAMETERS
    ===================================================== */

    const rawFlight =
      String(
        req.query.flight || ""
      ).trim();

    const requestedDate =
      String(
        req.query.date || ""
      ).trim();


    /* =====================================================
       VALIDATE FLIGHT
    ===================================================== */

    if (!rawFlight) {

      return response(
        res,
        400,
        {
          success: false,
          error: "Missing flight number."
        }
      );

    }


    const normalizedFlight =
      normalizeFlight(rawFlight);


    if (!normalizedFlight) {

      return response(
        res,
        400,
        {
          success: false,
          error: "Invalid flight number."
        }
      );

    }


    /* =====================================================
       VALIDATE DATE
    ===================================================== */

    if (!requestedDate) {

      return response(
        res,
        400,
        {
          success: false,
          error: "Missing date."
        }
      );

    }


    if (!validDate(requestedDate)) {

      return response(
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
       DISPLAY FLIGHT
    ===================================================== */

    const formattedFlight =
      displayFlight(rawFlight);


    /*
     * IMPORTANT:
     *
     * We search the FLIGHT NUMBER directly.
     *
     * We don't depend on Google understanding
     * the date as part of the flight query.
     */

    const queries = [

      `"${formattedFlight}"`,

      `"${normalizedFlight}"`,

      `${formattedFlight} flight`

    ];


    let flightResult = null;
    let dateRecord = null;
    let lastData = null;


    /* =====================================================
       SEARCH SERPAPI
    ===================================================== */

    for (
      const query of queries
    ) {

      console.log(
        "BOKKARA SEARCH:",
        query
      );

      const data =
        await serpapiSearch(query);

      lastData = data;


      const candidate =
        getFlightResult(data);


      /*
       * If Google gave us a proper
       * flight_result, use it.
       */

      if (
        candidate &&
        flightMatches(
          candidate,
          normalizedFlight
        )
      ) {

        const exactDate =
          findDate(
            candidate,
            requestedDate
          );


        /*
         * Exact requested date found.
         */

        if (exactDate) {

          flightResult =
            candidate;

          dateRecord =
            exactDate;

          break;

        }

      }


      /*
       * Answer box fallback.
       */

      const fallback =
        answerBoxResult(
          data,
          normalizedFlight,
          requestedDate
        );


      if (fallback) {

        return response(
          res,
          200,
          {
            success: true,

            query: {
              flight: rawFlight,
              normalized_flight:
                normalizedFlight,
              date:
                requestedDate
            },

            flight_result:
              fallback
          }
        );

      }

    }


    /* =====================================================
       NO EXACT DATE
    ===================================================== */

    if (
      !flightResult ||
      !dateRecord
    ) {

      console.log(
        "BOKKARA NO EXACT RESULT",
        {
          flight:
            normalizedFlight,

          date:
            requestedDate,

          hadFlightResult:
            !!getFlightResult(lastData)
        }
      );


      return response(
        res,
        404,
        {
          success: false,

          error:
            `Flight ${formattedFlight} was not found for ${requestedDate}.`,

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
       RETURN EXACT RESULT
    ===================================================== */

    const result =
      buildResult(
        flightResult,
        dateRecord,
        requestedDate
      );


    return response(
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

        flight_result:
          result
      }
    );


  } catch (error) {

    console.error(
      "BOKKARA AIRLINE SEARCH ERROR:",
      error
    );


    if (
      error?.name ===
      "AbortError"
    ) {

      return response(
        res,
        504,
        {
          success: false,

          error:
            "Flight search timed out. Please try again."
        }
      );

    }


    return response(
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
