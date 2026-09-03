export type Verdict = "Below" | "Fair" | "Above";

export interface PropertyResult {
  zpid: string;
  address: string;
  askingPrice: number;
  zestimate: number;
  sqft: number;
  homeType: string;
  beds: number | null;
  baths: number | null;
  yearBuilt: number | null;
  imageUrl: string | null;
}

export interface ValuationResult {
  compValue: number;
  fairValue: number;
  rangeLow: number;
  rangeHigh: number;
  verdict: Verdict;
  confidence: "Low" | "Medium" | "High";
  confidenceScore: number;
  compCount: number;
  medianPricePerSqft: number;
}

export interface CompResult {
  zpid: string;
  address: string;
  price: number;
  sqft: number;
  pricePerSqft: number;
  beds: number | null;
  baths: number | null;
  imageUrl: string | null;
}

export interface EvaluationResponse {
  property: PropertyResult;
  valuation: ValuationResult;
  comps: CompResult[];
}
