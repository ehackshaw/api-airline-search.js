// ============================================================
// BOKKARA — AIRLINE SEARCH API
// ============================================================
// Searches SerpApi Google Search for:
// - Airline names
// - Flight numbers
//
// Returns:
// - Airline name
// - IATA code
// - Airline logo
// - Official website
// - Flight number
//
// Endpoint:
// /api/airline-search?q=Caribbean%20Airlines
// /api/airline-search?q=BW526
//
// Environment variable:
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
  // QUERY
  // ----------------------------------------------------------

  const query = String(req.query.q || "").trim();

  if (!query) {
    return res.status(400).json({
      success: false,
      error: "Missing search query"
    });
  }

  if (query.length > 100) {
    return res.status(400).json({
      success: false,
      error: "Search query is too long"
    });
  }

  try {

    // --------------------------------------------------------
    // SERPAPI
    // --------------------------------------------------------

    const params = new URLSearchParams({
      engine: "google",
      q: query,
      api_key: apiKey,
      hl: "en",
      gl: "us"
    });

    const url =
      `https://serpapi.com/search.json?${params.toString()}`;

    const response = await fetch(url);

    const data = await response.json();

    // --------------------------------------------------------
    // SERPAPI ERROR
    // --------------------------------------------------------

    if (!response.ok || data.error) {

      console.error(
        "SerpApi error:",
        data.error || response.status
      );

      return res.status(502).json({
        success: false,
        error:
          data.error ||
          "SerpApi request failed"
      });
    }

    // --------------------------------------------------------
    // DEBUG LOG
    // --------------------------------------------------------

    console.log(
      "SerpApi query:",
      query
    );

    console.log(
      "Knowledge Graph:",
      JSON.stringify(
        data.knowledge_graph || null,
        null,
        2
      )
    );

    // --------------------------------------------------------
    // VARIABLES
    // --------------------------------------------------------

    let airlineName = null;
    let airlineCode = null;
    let airlineLogo = null;
    let airlineWebsite = null;
    let flightNumber = null;

    // ========================================================
    // 1. FLIGHT RESULT
    // ========================================================

    const flightResult =
      data.flight_result || null;

    if (flightResult) {

      airlineName =
        flightResult.airline ||
        null;

      airlineCode =
        flightResult.airline_iata_code ||
        null;

      flightNumber =
        flightResult.flight_designator ||
        null;

      // Some responses put the airline information
      // inside dates metadata.

      if (
        Array.isArray(flightResult.dates) &&
        flightResult.dates.length
      ) {

        const metadata =
          flightResult.dates[0]?.metadata;

        if (metadata) {

          airlineCode =
            airlineCode ||
            metadata.airline_iata_code ||
            null;

          if (!flightNumber) {

            if (
              metadata.airline_iata_code &&
              metadata.flight_number
            ) {

              flightNumber =
                `${metadata.airline_iata_code} ${metadata.flight_number}`;

            } else if (
              metadata.flight_number
            ) {

              flightNumber =
                metadata.flight_number;
            }
          }
        }
      }
    }

    // ========================================================
    // 2. KNOWLEDGE GRAPH
    // ========================================================

    const kg =
      data.knowledge_graph || null;

    if (kg) {

      // Name
      airlineName =
        airlineName ||
        kg.title ||
        kg.name ||
        null;

      // Logo / image
      airlineLogo =
        kg.image ||
        kg.thumbnail ||
        kg.logo ||
        null;

      // Website
      airlineWebsite =
        kg.website ||
        null;

      // IATA / airline code
      airlineCode =
        airlineCode ||
        kg.iata_code ||
        kg.iata ||
        null;

      // Sometimes Google puts identifiers
      // into a nested object.

      if (
        !airlineCode &&
        kg.identifiers
      ) {

        airlineCode =
          kg.identifiers.iata ||
          kg.identifiers.iata_code ||
          null;
      }
    }

    // ========================================================
    // 3. ORGANIC RESULTS
    // ========================================================

    const organic =
      Array.isArray(data.organic_results)
        ? data.organic_results
        : [];

    // --------------------------------------------------------
    // Try to identify airline from organic result
    // --------------------------------------------------------

    if (!airlineName) {

      const lowerQuery =
        query.toLowerCase();

      for (const result of organic) {

        const title =
          String(result.title || "");

        const snippet =
          String(result.snippet || "");

        const text =
          `${title} ${snippet}`.toLowerCase();

        // Strong airline indicators
        if (
          text.includes("airline") ||
          text.includes("airways") ||
          text.includes("airlines") ||
          text.includes("aviation")
        ) {

          airlineName =
            title
              .replace(
                /\s*[-|–—]\s*official.*$/i,
                ""
              )
              .trim();

          break;
        }

        // If the query itself looks like an airline
        // name, use the first highly relevant result.
        if (
          text.includes(lowerQuery)
        ) {

          airlineName =
            title
              .replace(
                /\s*[-|–—]\s*official.*$/i,
                ""
              )
              .trim();

          break;
        }
      }
    }

    // ========================================================
    // 4. FIND OFFICIAL WEBSITE
    // ========================================================

    if (!airlineWebsite) {

      for (const result of organic) {

        const link =
          result.link;

        if (!link) {
          continue;
        }

        if (!isValidWebsite(link)) {
          continue;
        }

        const title =
          String(result.title || "")
            .toLowerCase();

        const source =
          String(result.source || "")
            .toLowerCase();

        const airline =
          String(airlineName || "")
            .toLowerCase();

        // Strong match
        if (
          airline &&
          (
            title.includes(airline) ||
            source.includes(airline)
          )
        ) {

          airlineWebsite =
            cleanWebsite(link);

          break;
        }
      }
    }

    // ========================================================
    // 5. FIND LOGO FROM ORGANIC RESULT
    // ========================================================

    if (!airlineLogo) {

      for (const result of organic) {

        if (
          result.thumbnail &&
          airlineName
        ) {

          const title =
            String(result.title || "")
              .toLowerCase();

          const airline =
            airlineName.toLowerCase();

          if (
            title.includes(airline)
          ) {

            airlineLogo =
              result.thumbnail;

            break;
          }
        }
      }
    }

    // ========================================================
    // 6. TRY TO EXTRACT IATA CODE
    // ========================================================

    if (!airlineCode) {

      // Look for common patterns:
      //
      // Caribbean Airlines (BW)
      // Caribbean Airlines BW
      // BW - Caribbean Airlines

      const searchText =
        JSON.stringify(data);

      const codeMatch =
        searchText.match(
          /(?:iata[_\s-]*(?:code)?|airline_iata_code)["']?\s*[:=]\s*["']([A-Z0-9]{2,3})["']/i
        );

      if (codeMatch) {

        airlineCode =
          codeMatch[1].toUpperCase();
      }
    }

    // ========================================================
    // 7. CLEAN AIRLINE NAME
    // ========================================================

    if (airlineName) {

      airlineName =
        airlineName
          .replace(
            /\s*[-|–—]\s*(Official Site|Official Website|Home|Homepage).*$/i,
            ""
          )
          .trim();
    }

    // ========================================================
    // 8. NO AIRLINE
    // ========================================================

    if (!airlineName) {

      return res.status(404).json({

        success: false,

        found: false,

        query,

        error:
          "No airline found"
      });
    }

    // ========================================================
    // RESPONSE
    // ========================================================

    return res.status(200).json({

      success: true,

      found: true,

      query,

      airline: {

        name:
          airlineName,

        iata_code:
          airlineCode,

        flight_number:
          flightNumber,

        logo:
          airlineLogo,

        website:
          airlineWebsite
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
// WEBSITE VALIDATION
// ============================================================

function isValidWebsite(url) {

  try {

    const parsed =
      new URL(url);

    const hostname =
      parsed.hostname.toLowerCase();

    if (
      parsed.protocol !== "https:" &&
      parsed.protocol !== "http:"
    ) {
      return false;
    }

    const blocked = [

      "google.com",
      "googleusercontent.com",
      "serpapi.com",
      "youtube.com",
      "facebook.com",
      "instagram.com",
      "linkedin.com",
      "wikipedia.org",
      "tripadvisor.com",
      "expedia.com",
      "booking.com"

    ];

    return !blocked.some(
      domain =>
        hostname === domain ||
        hostname.endsWith(`.${domain}`)
    );

  } catch {

    return false;
  }
}


// ============================================================
// CLEAN WEBSITE
// ============================================================

function cleanWebsite(url) {

  try {

    const parsed =
      new URL(url);

    parsed.hash = "";

    const trackingParams = [

      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "gclid",
      "fbclid"

    ];

    trackingParams.forEach(
      param =>
        parsed.searchParams.delete(param)
    );

    return parsed.toString();

  } catch {

    return url;
  }
}
