import { FormEvent, useRef, useState } from "react";
import { ArrowRight, BedDouble, Bath, Building2, Check, Search, Sparkles } from "lucide-react";
import type { EvaluationResponse, PropertyResult, ValuationResult } from "./types";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function readableHomeType(homeType: string) {
  return homeType.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function PropertyImage({ property }: { property: PropertyResult }) {
  if (property.imageUrl) {
    return <img className="property-image" src={property.imageUrl} alt={`Exterior of ${property.address}`} />;
  }
  return (
    <div className="property-image image-placeholder" role="img" aria-label="Property image unavailable">
      <Building2 aria-hidden="true" />
    </div>
  );
}

function ValueChart({ property, valuation }: { property: PropertyResult; valuation: ValuationResult }) {
  const marks = [
    { label: "Asking price", value: property.askingPrice, className: "asking" },
    { label: "Zestimate", value: property.zestimate, className: "zestimate" },
    { label: "Comp value", value: valuation.compValue, className: "comp" },
  ];
  const allValues = [
    ...marks.map((mark) => mark.value),
    valuation.rangeLow,
    valuation.rangeHigh,
  ];
  const floor = Math.min(...allValues) * 0.94;
  const ceiling = Math.max(...allValues) * 1.06;
  const span = Math.max(ceiling - floor, 1);
  const position = (value: number) => `${((value - floor) / span) * 100}%`;

  return (
    <section className="chart-card" aria-labelledby="value-comparison-heading">
      <div className="section-heading-row">
        <div>
          <h2 id="value-comparison-heading">Value comparison</h2>
          <p>The shaded band is the calculated fair range.</p>
        </div>
      </div>
      <div
        className="value-plot"
        role="img"
        aria-label={`Asking price ${currency.format(property.askingPrice)}, Zestimate ${currency.format(property.zestimate)}, and comp value ${currency.format(valuation.compValue)}. Fair range ${currency.format(valuation.rangeLow)} to ${currency.format(valuation.rangeHigh)}.`}
      >
        <div className="plot-line" aria-hidden="true" />
        <div
          className="range-band"
          style={{ insetInlineStart: position(valuation.rangeLow), width: `${((valuation.rangeHigh - valuation.rangeLow) / span) * 100}%` }}
          aria-hidden="true"
        />
        {marks.map((mark) => (
          <div className={`chart-mark ${mark.className}`} style={{ insetInlineStart: position(mark.value) }} key={mark.label} aria-hidden="true">
            <span className="mark-dot" />
          </div>
        ))}
      </div>
      <div className="chart-legend" aria-hidden="true">
        {marks.map((mark) => (
          <div className="legend-item" key={mark.label}>
            <span className={`legend-swatch ${mark.className}`} />
            <span>{mark.label}</span>
            <strong>{currency.format(mark.value)}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function Results({ result, onReset }: { result: EvaluationResponse; onReset: () => void }) {
  const { property, valuation, comps } = result;
  const facts = [
    property.beds ? `${number.format(property.beds)} beds` : null,
    property.baths ? `${number.format(property.baths)} baths` : null,
    `${number.format(property.sqft)} sq ft`,
    readableHomeType(property.homeType),
  ].filter(Boolean);

  return (
    <main id="main-content" className="results-shell">
      <div className="results-nav">
        <a className="brand compact" href="/" onClick={(event) => { event.preventDefault(); onReset(); }}>
          <span className="brand-mark">H</span>
          <span>Property Fair Value</span>
        </a>
        <button className="text-button" type="button" onClick={onReset}>Check another home</button>
      </div>

      <article className="property-hero">
        <PropertyImage property={property} />
        <div className="property-summary">
          <h1>{property.address}</h1>
          <p className="property-facts">{facts.join(" · ")}</p>
          <div className="asking-price">
            <span>Asking price</span>
            <strong>{currency.format(property.askingPrice)}</strong>
          </div>
        </div>
      </article>

      <section className="valuation-hero" aria-labelledby="fair-value-heading">
        <div className="fair-value-copy">
          <h2 id="fair-value-heading">Fair value</h2>
          <p className="fair-value-number">{currency.format(valuation.fairValue)}</p>
          <p className="fair-range">{currency.format(valuation.rangeLow)}–{currency.format(valuation.rangeHigh)}</p>
        </div>
        <div className="verdict-panel">
          <span className={`verdict verdict-${valuation.verdict.toLowerCase()}`}>
            {valuation.verdict === "Fair" ? <Check size={18} strokeWidth={2} aria-hidden="true" /> : <ArrowRight size={18} strokeWidth={2} aria-hidden="true" />}
            {valuation.verdict}
          </span>
          <div className="confidence-copy">
            <strong>{valuation.confidence} confidence · {valuation.confidenceScore}%</strong>
            <span>{valuation.compCount} matching comps · median {currency.format(valuation.medianPricePerSqft)}/sq ft</span>
          </div>
        </div>
      </section>

      <ValueChart property={property} valuation={valuation} />

      <section className="comps-section" aria-labelledby="comps-heading">
        <div className="section-heading-row">
          <div>
            <h2 id="comps-heading">Closest matches</h2>
            <p>Same home type and 70–130% of the subject’s square footage.</p>
          </div>
          <p className="comp-formula">Comp value <strong>{currency.format(valuation.compValue)}</strong></p>
        </div>
        <div className="comps-list">
          {comps.map((comp, index) => (
            <article className="comp-row" key={comp.zpid || `${comp.address}-${index}`}>
              {comp.imageUrl ? (
                <img src={comp.imageUrl} alt="" className="comp-image" loading="lazy" />
              ) : (
                <div className="comp-image comp-image-placeholder" aria-hidden="true"><Building2 /></div>
              )}
              <div className="comp-address">
                <h3>{comp.address}</h3>
                <p>
                  {comp.beds ? <span><BedDouble aria-hidden="true" />{number.format(comp.beds)}</span> : null}
                  {comp.baths ? <span><Bath aria-hidden="true" />{number.format(comp.baths)}</span> : null}
                  <span>{number.format(comp.sqft)} sq ft</span>
                </p>
              </div>
              <div className="comp-price">
                <strong>{currency.format(comp.price)}</strong>
                <span>{currency.format(comp.pricePerSqft)}/sq ft</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <footer>
        Independent ZillAPI demo. Not an appraisal or investment advice.
      </footer>
    </main>
  );
}

export default function App() {
  const [address, setAddress] = useState("");
  const [result, setResult] = useState<EvaluationResponse | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const addressRef = useRef<HTMLInputElement>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanedAddress = address.trim();
    if (cleanedAddress.length < 6) {
      setError("Enter a full US street address, including city and state.");
      addressRef.current?.focus();
      return;
    }

    setError("");
    setIsLoading(true);
    try {
      const response = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: cleanedAddress }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Unable to calculate a fair value.");
      setResult(payload);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to calculate a fair value. Try again.");
      addressRef.current?.focus();
    } finally {
      setIsLoading(false);
    }
  }

  function reset() {
    setResult(null);
    setError("");
    setAddress("");
    window.requestAnimationFrame(() => addressRef.current?.focus());
  }

  if (result) return <Results result={result} onReset={reset} />;

  return (
    <>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="site-header">
        <a className="brand" href="/" aria-label="Property Fair Value home">
          <span className="brand-mark">H</span>
          <span>Property Fair Value</span>
        </a>
        <span className="method-note"><Sparkles aria-hidden="true" />Formula, not AI</span>
      </header>
      <main id="main-content" className="landing-shell">
        <section className="intro">
          <h1>What is this home worth?</h1>
          <p>Compare its Zestimate with similar nearby homes in one clear estimate.</p>
        </section>

        <form className="search-card" onSubmit={submit} noValidate>
          <label htmlFor="address">Property address</label>
          <div className={`input-row ${error ? "has-error" : ""}`}>
            <Search aria-hidden="true" />
            <input
              ref={addressRef}
              id="address"
              name="address"
              type="text"
              autoComplete="street-address"
              placeholder="2804 Wilson St #B, Austin, TX 78704"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "address-error" : "address-hint"}
            />
            <button type="submit" disabled={isLoading}>
              {isLoading ? <span className="spinner" aria-hidden="true" /> : null}
              {isLoading ? "Calculating…" : "Estimate value"}
            </button>
          </div>
          <p id="address-hint" className="field-hint">Use the full address of a current for-sale listing.</p>
          <p id="address-error" className="field-error" role="alert">{error}</p>
        </form>

        <section className="method-grid" aria-label="Valuation method">
          <div>
            <span className="method-number">60%</span>
            <p>Zestimate</p>
          </div>
          <div>
            <span className="method-number">40%</span>
            <p>Nearby comps</p>
          </div>
          <div>
            <span className="method-number">±7%</span>
            <p>Fair range</p>
          </div>
        </section>
      </main>
    </>
  );
}
