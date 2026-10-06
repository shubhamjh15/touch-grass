/**
 * The one door from the Impact page to the climate contract, which lives with the server code
 * that produces it (server/climate). Types, the live rule and the payload check only: nothing
 * here pulls server logic into the browser.
 */
export {
  isLive,
  type ClimatePayload,
  type ClimateSource,
  type Co2Signal,
  type GasSignal,
  type PerPersonRow,
  type PerPersonSignal,
  type SignalMeta,
  type TemperatureSignal,
} from '../../../../server/climate/contract';
export { parseClimatePayload } from '../../../../server/climate/validate';
