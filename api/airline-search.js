// ============================================================
// BOKKARA AIRLINE SEARCH API
// ============================================================
//
// Searches SerpApi Google Search for:
//   - Airline names
//   - Flight numbers
//
// Returns:
//   - Airline name
//   - IATA code
//   - Airline logo
//   - Official website
//   - Flight number when available
//
// Endpoint:
// GET /api/airline-search?q=BW526
//
// Environment variable required:
// SERPAPI_API_KEY
// ============================================================

export default async function handler(req, res) {

  // ----------------------------------------------------------
  // CORS
  // ----------------------------------------------------------

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  // ----------------------------------------------------------
  // API KEY
  // ----------------------------------------------------------

  const apiKey = process.env.SERPAPI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      success: false,
      error: "SERPAPI_API_KEY is not configured"
    });
  }

  // ----------------------------------------------------------
  // SEARCH QUERY
  // ----------------------------------------------------------

  const rawQuery = req.query.q;

  if (!rawQuery) {
    return res.status(400).json({
      success: false,
      error: "Missing search query"
    });
  }

  const query = String(rawQuery).trim();

  if (!query) {
    return res.status(400).json({
      success: false,
      error: "Search query cannot be empty"
    });
  }

  // Prevent excessively large searches
  if (query.length > 100) {
    return res.status(400).json({
      success: false,
      error: "Search query is too long"
    });
  }

  try {

    // --------------------------------------------------------
    // SERPAPI GOOGLE SEARCH
    // --------------------------------------------------------

    const params = new URLSearchParams({
      engine: "google",
      q: query,
      api_key: apiKey,
      hl: "en",
      gl: "us"
    });

    const serpApiUrl =
      `https://serpapi.com/search.json?${params.toString()}`;

    const response = await fetch(serpApiUrl);

    if (!response.ok) {

      const errorText = await response.text();

      console.error(
        "SerpApi HTTP error:",
        response.status,
        errorText
      );

      return res.status(502).json({
        success: false,
        error: "SerpApi request failed"
      });
    }

    const data = await response.json();

    // --------------------------------------------------------
    // SERPAPI ERROR
    // --------------------------------------------------------

    if (data.error) {

      console.error(
        "SerpApi error:",
        data.error
      );

      return res.status(502).json({
        success: false,
        error: data.error
      });
    }

    // --------------------------------------------------------
    // DETECT FLIGHT RESULT
    // --------------------------------------------------------

    const flightResult =
      data.flight_result || null;

    // --------------------------------------------------------
    // DETECT KNOWLEDGE GRAPH
    // --------------------------------------------------------

    const knowledgeGraph =
      data.knowledge_graph || null;

    // --------------------------------------------------------
    // AIRLINE INFORMATION
    // --------------------------------------------------------

    let airlineName = null;
    let airlineCode = null;
    let flightNumber = null;
    let logo = null;
    let website = null;

    // --------------------------------------------------------
    // 1. FLIGHT RESULT
    // --------------------------------------------------------

    if (flightResult) {

      airlineName =
        flightResult.airline ||
        null;

      airlineCode =
        flightResult.airline_iata_code ||
        null;

      // Try to get flight number
      if (flightResult.flight_designator) {

        flightNumber =
          flightResult.flight_designator;

      } else if (
        Array.isArray(flightResult.dates) &&
        flightResult.dates.length > 0
      ) {

        const metadata =
          flightResult.dates[0]?.metadata;

        if (metadata) {

          if (!airlineCode) {
            airlineCode =
              metadata.airline_iata_code ||
              null;
          }

          if (
            metadata.flight_number
          ) {
            flightNumber =
              `${metadata.airline_iata_code || airlineCode || ""} ${metadata.flight_number}`
              .trim();
          }
        }
      }
    }

    // --------------------------------------------------------
    // 2. KNOWLEDGE GRAPH
    // --------------------------------------------------------

    if (knowledgeGraph) {

      if (!airlineName) {

        airlineName =
          knowledgeGraph.title ||
          null;
      }

      if (!logo) {

        logo =
          knowledgeGraph.image ||
          knowledgeGraph.thumbnail ||
          null;
      }

      if (!website) {

        website =
          knowledgeGraph.website ||
          null;
      }
    }

    // --------------------------------------------------------
    // 3. SEARCH ORGANIC RESULTS
    //
    // Use these as additional information.
    // --------------------------------------------------------

    const organicResults =
      Array.isArray(data.organic_results)
        ? data.organic_results
        : [];

    // --------------------------------------------------------
    // FIND POSSIBLE AIRLINE WEBSITE
    // --------------------------------------------------------

    if (!website && airlineName) {

      const normalizedAirline =
        airlineName
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "");

      for (const result of organicResults) {

        const title =
          String(result.title || "");

        const link =
          String(result.link || "");

        const source =
          String(result.source || "");

        const combined =
          `${title} ${source}`.toLowerCase();

        // Prefer results whose title/source
        // contains the airline name.
        const normalizedText =
          combined
            .replace(/[^a-z0-9]/g, "");

        if (
          normalizedText.includes(
            normalizedAirline
          ) &&
          isLikelyWebsite(link)
        ) {

          website = link;
          break;
        }
      }
    }

    // --------------------------------------------------------
    // FIND LOGO FROM ORGANIC RESULTS IF NECESSARY
    // --------------------------------------------------------

    if (!logo) {

      for (const result of organicResults) {

        if (
          result.thumbnail &&
          airlineName
        ) {

          const title =
            String(result.title || "")
              .toLowerCase();

          const name =
            airlineName.toLowerCase();

          if (
            title.includes(name)
          ) {

            logo =
              result.thumbnail;

            break;
          }
        }
      }
    }

    // --------------------------------------------------------
    // NORMALIZE WEBSITE
    // --------------------------------------------------------

    if (website) {

      website =
        normalizeWebsite(website);
    }

    // --------------------------------------------------------
    // NOTHING FOUND
    // --------------------------------------------------------

    if (!airlineName) {

      return res.status(404).json({
        success: false,
        found: false,
        query,
        error: "No airline found"
      });
    }

    // --------------------------------------------------------
    // RESPONSE
    // --------------------------------------------------------

    return res.status(200).json({

      success: true,

      found: true,

      query,

      airline: {

        name: airlineName,

        iata_code:
          airlineCode,

        flight_number:
          flightNumber,

        logo:
          logo,

        website:
          website
      }
    });

  } catch (error) {

    console.error(
      "Airline search error:",
      error
    );

    return res.status(500).json({

      success: false,

      error:
        "Unable to search for airline"
    });
  }
}


// ============================================================
// HELPERS
// ============================================================

function isLikelyWebsite(url) {

  try {

    const parsed =
      new URL(url);

    if (
      parsed.protocol !== "https:" &&
      parsed.protocol !== "http:"
    ) {
      return false;
    }

    // Don't return Google/SerpApi/internal
    // search URLs as the airline website.
    const hostname =
      parsed.hostname.toLowerCase();

    const blockedHosts = [

      "google.com",
      "googleusercontent.com",
      "serpapi.com",
      "youtube.com",
      "facebook.com",
      "instagram.com",
      "linkedin.com",
      "wikipedia.org"

    ];

    return !blockedHosts.some(
      blocked =>
        hostname === blocked ||
        hostname.endsWith(`.${blocked}`)
    );

  } catch {

    return false;
  }
}


function normalizeWebsite(url) {

  try {

    const parsed =
      new URL(url);

    parsed.hash = "";

    // Remove common tracking parameters.
    const removeParams = [

      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "gclid",
      "fbclid"

    ];

    removeParams.forEach(
      param =>
        parsed.searchParams.delete(param)
    );

    return parsed.toString();

  } catch {

    return url;
  }
}
