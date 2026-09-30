"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  LineSeries,
  createChart,
  type IChartApi,
  type Time,
} from "lightweight-charts";

/* =========================================================
   TYPES
========================================================= */

type SymbolId =
  | "AAPL"
  | "TSLA"
  | "NVDA"
  | "AMZN"
  | "MSFT"
  | "SPY"
  | "BTCUSD"
  | "ETHUSD"
  | "GBPUSD"
  | "EURUSD";

type Timeframe =
  | "1m"
  | "5m"
  | "15m"
  | "1h"
  | "4h"
  | "1D"
  | "1W";

type Range =
  | "1D"
  | "5D"
  | "1M"
  | "3M"
  | "6M"
  | "YTD"
  | "1Y"
  | "5Y"
  | "All";

type Candle = {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type Point = {
  time: Time;
  value: number;
};

type SymbolConfig = {
  name: string;
  exchange: string;
  currency: string;
  base: number;
  volatility: number;
  drift: number;
  volume: number;
  decimals: number;
};

/* =========================================================
   SYMBOLS
========================================================= */

const SYMBOLS: Record<SymbolId, SymbolConfig> = {
  AAPL: {
    name: "Apple Inc.",
    exchange: "NASDAQ",
    currency: "USD",
    base: 205,
    volatility: 0.012,
    drift: 0.00035,
    volume: 75_000_000,
    decimals: 2,
  },

  TSLA: {
    name: "Tesla Inc.",
    exchange: "NASDAQ",
    currency: "USD",
    base: 325,
    volatility: 0.024,
    drift: 0.0004,
    volume: 95_000_000,
    decimals: 2,
  },

  NVDA: {
    name: "NVIDIA Corp.",
    exchange: "NASDAQ",
    currency: "USD",
    base: 180,
    volatility: 0.021,
    drift: 0.0005,
    volume: 150_000_000,
    decimals: 2,
  },

  AMZN: {
    name: "Amazon.com Inc.",
    exchange: "NASDAQ",
    currency: "USD",
    base: 225,
    volatility: 0.016,
    drift: 0.0003,
    volume: 45_000_000,
    decimals: 2,
  },

  MSFT: {
    name: "Microsoft Corp.",
    exchange: "NASDAQ",
    currency: "USD",
    base: 510,
    volatility: 0.011,
    drift: 0.0003,
    volume: 28_000_000,
    decimals: 2,
  },

  SPY: {
    name: "SPDR S&P 500 ETF",
    exchange: "NYSE",
    currency: "USD",
    base: 665,
    volatility: 0.009,
    drift: 0.00025,
    volume: 48_000_000,
    decimals: 2,
  },

  BTCUSD: {
    name: "Bitcoin",
    exchange: "CRYPTO",
    currency: "USD",
    base: 112_000,
    volatility: 0.020,
    drift: 0.00045,
    volume: 38_000,
    decimals: 2,
  },

  ETHUSD: {
    name: "Ethereum",
    exchange: "CRYPTO",
    currency: "USD",
    base: 4_100,
    volatility: 0.025,
    drift: 0.0004,
    volume: 520_000,
    decimals: 2,
  },

  GBPUSD: {
    name: "British Pound / US Dollar",
    exchange: "FOREX",
    currency: "USD",
    base: 1.355,
    volatility: 0.0045,
    drift: 0.00008,
    volume: 2_500_000,
    decimals: 5,
  },

  EURUSD: {
    name: "Euro / US Dollar",
    exchange: "FOREX",
    currency: "USD",
    base: 1.175,
    volatility: 0.0035,
    drift: 0.00005,
    volume: 2_100_000,
    decimals: 5,
  },
};

/* =========================================================
   RANDOM NUMBER GENERATOR
========================================================= */

function mulberry32(seed: number) {
  return function random() {
    let t = (seed += 0x6d2b79f5);

    t = Math.imul(t ^ (t >>> 15), t | 1);

    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* =========================================================
   DEMO MARKET DATA
========================================================= */

function generateCandles(
  symbol: SymbolId,
  count = 300
): Candle[] {
  const config = SYMBOLS[symbol];

  const seed = symbol
    .split("")
    .reduce(
      (sum, char) => sum + char.charCodeAt(0),
      0
    );

  const random = mulberry32(seed * 7919);

  const candles: Candle[] = [];

  let price =
    config.base *
    (0.87 + random() * 0.08);

  const now = new Date();

  now.setUTCHours(0, 0, 0, 0);

  now.setUTCDate(
    now.getUTCDate() - count
  );

  for (let i = 0; i < count; i++) {
    const time =
      Math.floor(now.getTime() / 1000) +
      i * 86400;

    const open = price;

    const randomShock =
      (random() - 0.5) *
      config.volatility;

    const trend =
      config.drift +
      (random() - 0.5) *
        config.volatility *
        0.5;

    const close = Math.max(
      price * 0.01,
      price *
        (1 + trend + randomShock)
    );

    const range =
      config.volatility *
      (0.6 + random() * 0.9);

    const high =
      Math.max(open, close) *
      (1 + random() * range);

    const low =
      Math.min(open, close) *
      (1 - random() * range);

    const volume =
      config.volume *
      (0.5 + random() * 1.1);

    candles.push({
      time: time as Time,
      open,
      high,
      low,
      close,
      volume,
    });

    price = close;
  }

  return candles;
}

/* =========================================================
   EMA
========================================================= */

function calculateEMA(
  values: number[],
  period: number
): number[] {
  if (!values.length) return [];

  const multiplier =
    2 / (period + 1);

  const result: number[] = [];

  let previous = values[0];

  result.push(previous);

  for (let i = 1; i < values.length; i++) {
    previous =
      values[i] * multiplier +
      previous * (1 - multiplier);

    result.push(previous);
  }

  return result;
}

/* =========================================================
   AROON
========================================================= */

function calculateAroon(
  candles: Candle[],
  period = 14
) {
  const up: Point[] = [];
  const down: Point[] = [];

  for (let i = 0; i < candles.length; i++) {
    const start = Math.max(
      0,
      i - period + 1
    );

    const window =
      candles.slice(start, i + 1);

    let highestIndex = 0;
    let lowestIndex = 0;

    for (
      let j = 1;
      j < window.length;
      j++
    ) {
      if (
        window[j].high >=
        window[highestIndex].high
      ) {
        highestIndex = j;
      }

      if (
        window[j].low <=
        window[lowestIndex].low
      ) {
        lowestIndex = j;
      }
    }

    const periodsSinceHigh =
      window.length -
      1 -
      highestIndex;

    const periodsSinceLow =
      window.length -
      1 -
      lowestIndex;

    up.push({
      time: candles[i].time,
      value:
        ((period -
          periodsSinceHigh) /
          period) *
        100,
    });

    down.push({
      time: candles[i].time,
      value:
        ((period -
          periodsSinceLow) /
          period) *
        100,
    });
  }

  return {
    up,
    down,
  };
}

/* =========================================================
   CHAIKIN OSCILLATOR
========================================================= */

function calculateChaikin(
  candles: Candle[],
  fast = 3,
  slow = 10
): Point[] {
  let accumulated = 0;

  const adl: number[] = [];

  for (const candle of candles) {
    const range =
      candle.high -
      candle.low;

    const safeRange =
      range === 0
        ? 0.000001
        : range;

    const multiplier =
      ((candle.close -
        candle.low) -
        (candle.high -
          candle.close)) /
      safeRange;

    accumulated +=
      multiplier *
      candle.volume;

    adl.push(accumulated);
  }

  const fastEMA =
    calculateEMA(adl, fast);

  const slowEMA =
    calculateEMA(adl, slow);

  return candles.map(
    (candle, index) => ({
      time: candle.time,
      value:
        fastEMA[index] -
        slowEMA[index],
    })
  );
}

/* =========================================================
   KLINGER OSCILLATOR
========================================================= */

function calculateKlinger(
  candles: Candle[],
  fast = 34,
  slow = 55
): Point[] {
  const force: number[] = [];

  let previousTrend = 1;

  for (
    let i = 0;
    i < candles.length;
    i++
  ) {
    if (i === 0) {
      force.push(0);
      continue;
    }

    const current =
      candles[i];

    const previous =
      candles[i - 1];

    const currentTypical =
      current.high +
      current.low +
      current.close;

    const previousTypical =
      previous.high +
      previous.low +
      previous.close;

    const trend =
      currentTypical >=
      previousTypical
        ? 1
        : -1;

    const dm =
      Math.max(
        current.high -
          current.low,
        0.000001
      );

    const cm =
      previousTrend === trend
        ? dm
        : 0;

    const ratio =
      dm /
      (dm + cm || dm);

    const volumeForce =
      trend *
      current.volume *
      (2 * ratio - 1);

    force.push(volumeForce);

    previousTrend = trend;
  }

  const fastEMA =
    calculateEMA(
      force,
      fast
    );

  const slowEMA =
    calculateEMA(
      force,
      slow
    );

  return candles.map(
    (candle, index) => ({
      time: candle.time,
      value:
        fastEMA[index] -
        slowEMA[index],
    })
  );
}

/* =========================================================
   FORMATTERS
========================================================= */

function formatPrice(
  value: number,
  decimals: number
) {
  return value.toLocaleString(
    "en-US",
    {
      minimumFractionDigits:
        decimals,
      maximumFractionDigits:
        decimals,
    }
  );
}

function formatCompact(
  value: number
) {
  const abs = Math.abs(value);

  if (abs >= 1_000_000_000) {
    return (
      (value / 1_000_000_000)
        .toFixed(2) + "B"
    );
  }

  if (abs >= 1_000_000) {
    return (
      (value / 1_000_000)
        .toFixed(2) + "M"
    );
  }

  if (abs >= 1_000) {
    return (
      (value / 1_000)
        .toFixed(2) + "K"
    );
  }

  return value.toFixed(0);
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function TradeChart() {
  const [symbol, setSymbol] =
    useState<SymbolId>("AAPL");

  const [timeframe, setTimeframe] =
    useState<Timeframe>("1D");

  const [range, setRange] =
    useState<Range>("1D");

  const [showEMA, setShowEMA] =
    useState(true);

  const [showAroon, setShowAroon] =
    useState(true);

  const [showChaikin, setShowChaikin] =
    useState(true);

  const [showKlinger, setShowKlinger] =
    useState(true);

  const chartContainerRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const chartRef =
    useRef<IChartApi | null>(null);

  const config =
    SYMBOLS[symbol];

  const candles = useMemo(
    () =>
      generateCandles(
        symbol,
        300
      ),
    [symbol]
  );

  const latest =
    candles[candles.length - 1];

  const previous =
    candles[candles.length - 2];

  const change =
    latest.close -
    previous.close;

  const changePercent =
    (change /
      previous.close) *
    100;

  /* =======================================================
     CREATE CHART
  ======================================================= */

  useEffect(() => {
    if (
      !chartContainerRef.current
    ) {
      return;
    }

    const container =
      chartContainerRef.current;

    const chart =
      createChart(
        container,
        {
          width:
            container.clientWidth,

          height: 800,

          layout: {
            background: {
              type:
                ColorType.Solid,
              color:
                "#0b0d10",
            },

            textColor:
              "#a7adb7",

            panes: {
              separatorColor:
                "#20242c",

              separatorHoverColor:
                "#303640",

              enableResize:
                true,
            },
          },

          grid: {
            vertLines: {
              color:
                "#15181e",
            },

            horzLines: {
              color:
                "#15181e",
            },
          },

          crosshair: {
            vertLine: {
              color:
                "#697386",

              width: 1,

              style: 3,

              labelBackgroundColor:
                "#252a34",
            },

            horzLine: {
              color:
                "#697386",

              width: 1,

              style: 3,

              labelBackgroundColor:
                "#252a34",
            },
          },

          rightPriceScale: {
            borderColor:
              "#252a32",

            textColor:
              "#a7adb7",

            scaleMargins: {
              top: 0.06,
              bottom: 0.06,
            },
          },

          timeScale: {
            borderColor:
              "#252a32",

            timeVisible:
              true,

            secondsVisible:
              false,

            rightOffset: 8,

            barSpacing: 7,
          },

          handleScale: {
            mouseWheel: true,
            pinch: true,
          },

          handleScroll: {
            mouseWheel: true,
            pressedMouseMove: true,
            horzTouchDrag: true,
            vertTouchDrag: true,
          },
        }
      );

    chartRef.current =
      chart;

    /* =====================================================
       MAIN CANDLESTICK SERIES
    ===================================================== */

    const candleSeries =
      chart.addSeries(
        CandlestickSeries,
        {
          upColor:
            "#00c896",

          downColor:
            "#ff4d67",

          borderVisible:
            false,

          wickUpColor:
            "#00c896",

          wickDownColor:
            "#ff4d67",

          priceFormat: {
            type: "price",

            precision:
              config.decimals,

            minMove:
              config.decimals ===
              5
                ? 0.00001
                : 0.01,
          },
        },

        0
      );

    candleSeries.setData(
      candles.map(
        (candle) => ({
          time:
            candle.time,

          open:
            candle.open,

          high:
            candle.high,

          low:
            candle.low,

          close:
            candle.close,
        })
      )
    );

    /* =====================================================
       VOLUME
    ===================================================== */

    const volumeSeries =
      chart.addSeries(
        HistogramSeries,
        {
          priceFormat: {
            type:
              "volume",
          },

          priceScaleId:
            "volume",
        },

        0
      );

    volumeSeries.setData(
      candles.map(
        (candle) => ({
          time:
            candle.time,

          value:
            candle.volume,

          color:
            candle.close >=
            candle.open
              ? "rgba(0,200,150,0.45)"
              : "rgba(255,77,103,0.45)",
        })
      )
    );

    chart
      .priceScale("volume")
      .applyOptions({
        scaleMargins: {
          top: 0.78,
          bottom: 0,
        },

        visible: false,
      });

    /* =====================================================
       EMA 20 / EMA 50
    ===================================================== */

    if (showEMA) {
      const closes =
        candles.map(
          (candle) =>
            candle.close
        );

      const ema20 =
        calculateEMA(
          closes,
          20
        );

      const ema50 =
        calculateEMA(
          closes,
          50
        );

      const ema20Series =
        chart.addSeries(
          LineSeries,
          {
            color:
              "#ff9f00",

            lineWidth: 2,

            priceLineVisible:
              false,

            lastValueVisible:
              false,

            title:
              "EMA 20",
          },

          0
        );

      const ema50Series =
        chart.addSeries(
          LineSeries,
          {
            color:
              "#7c5cff",

            lineWidth: 2,

            priceLineVisible:
              false,

            lastValueVisible:
              false,

            title:
              "EMA 50",
          },

          0
        );

      ema20Series.setData(
        candles.map(
          (candle, index) => ({
            time:
              candle.time,

            value:
              ema20[index],
          })
        )
      );

      ema50Series.setData(
        candles.map(
          (candle, index) => ({
            time:
              candle.time,

            value:
              ema50[index],
          })
        )
      );
    }

    /* =====================================================
       AROON PANE
    ===================================================== */

    if (showAroon) {
      const aroon =
        calculateAroon(
          candles,
          14
        );

      const aroonUp =
        chart.addSeries(
          LineSeries,
          {
            color:
              "#ff9f00",

            lineWidth: 2,

            priceLineVisible:
              false,

            title:
              "Aroon Up",
          },

          1
        );

      const aroonDown =
        chart.addSeries(
          LineSeries,
          {
            color:
              "#3478ff",

            lineWidth: 2,

            priceLineVisible:
              false,

            title:
              "Aroon Down",
          },

          1
        );

      aroonUp.setData(
        aroon.up
      );

      aroonDown.setData(
        aroon.down
      );

      chart
        .panes()[1]
        ?.setHeight(145);
    }

    /* =====================================================
       CHAIKIN PANE
    ===================================================== */

    if (showChaikin) {
      const chaikin =
        calculateChaikin(
          candles
        );

      const chaikinSeries =
        chart.addSeries(
          LineSeries,
          {
            color:
              "#ff4d67",

            lineWidth: 2,

            priceLineVisible:
              false,

            title:
              "Chaikin Osc",
          },

          2
        );

      chaikinSeries.setData(
        chaikin
      );

      chart
        .panes()[2]
        ?.setHeight(135);
    }

    /* =====================================================
       KLINGER PANE
    ===================================================== */

    if (showKlinger) {
      const klinger =
        calculateKlinger(
          candles
        );

      const klingerSeries =
        chart.addSeries(
          LineSeries,
          {
            color:
              "#3478ff",

            lineWidth: 2,

            priceLineVisible:
              false,

            title:
              "Klinger Osc",
          },

          3
        );

      klingerSeries.setData(
        klinger
      );

      const zeroLine =
        chart.addSeries(
          LineSeries,
          {
            color:
              "#2dc6c6",

            lineWidth: 1,

            priceLineVisible:
              false,

            lastValueVisible:
              false,
          },

          3
        );

      zeroLine.setData(
        candles.map(
          (candle) => ({
            time:
              candle.time,

            value: 0,
          })
        )
      );

      chart
        .panes()[3]
        ?.setHeight(135);
    }

    /* =====================================================
       FIT CHART
    ===================================================== */

    chart
      .timeScale()
      .fitContent();

    /* =====================================================
       RESPONSIVE RESIZE
    ===================================================== */

    const resizeObserver =
      new ResizeObserver(
        () => {
          if (
            !container
          ) {
            return;
          }

          chart.applyOptions({
            width:
              container.clientWidth,
          });
        }
      );

    resizeObserver.observe(
      container
    );

    /* =====================================================
       CLEANUP
    ===================================================== */

    return () => {
      resizeObserver.disconnect();

      chart.remove();

      chartRef.current =
        null;
    };
  }, [
    candles,
    config.decimals,
    showEMA,
    showAroon,
    showChaikin,
    showKlinger,
  ]);

  /* =======================================================
     JSX
  ======================================================= */

  return (
    <div className="trade-terminal">

      {/* ===================================================
          TOP TOOLBAR
      =================================================== */}

      <div className="trade-toolbar">

        <div className="toolbar-left">

          <button
            className="icon-button"
            type="button"
          >
            ☰
          </button>

          {/* SYMBOL SEARCH */}

          <div className="symbol-search">

            <span>
              ⌕
            </span>

            <select
              value={symbol}
              onChange={(event) =>
                setSymbol(
                  event.target
                    .value as SymbolId
                )
              }
            >
              {Object.entries(
                SYMBOLS
              ).map(
                ([
                  id,
                  item,
                ]) => (
                  <option
                    key={id}
                    value={id}
                  >
                    {id}
                  </option>
                )
              )}
            </select>

          </div>

          <button
            className="plus-button"
            type="button"
          >
            +
          </button>

          {/* TIMEFRAMES */}

          <div className="timeframe-buttons">

            {(
              [
                "1m",
                "5m",
                "15m",
                "1h",
                "4h",
                "1D",
                "1W",
              ] as Timeframe[]
            ).map(
              (item) => (
                <button
                  key={item}
                  type="button"
                  className={
                    timeframe ===
                    item
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setTimeframe(
                      item
                    )
                  }
                >
                  {item}
                </button>
              )
            )}

          </div>

        </div>

        {/* INDICATORS */}

        <div className="indicator-buttons">

          <button
            type="button"
            className={
              showEMA
                ? "active"
                : ""
            }
            onClick={() =>
              setShowEMA(
                (value) =>
                  !value
              )
            }
          >
            EMA
          </button>

          <button
            type="button"
            className={
              showAroon
                ? "active"
                : ""
            }
            onClick={() =>
              setShowAroon(
                (value) =>
                  !value
              )
            }
          >
            Aroon
          </button>

          <button
            type="button"
            className={
              showChaikin
                ? "active"
                : ""
            }
            onClick={() =>
              setShowChaikin(
                (value) =>
                  !value
              )
            }
          >
            Chaikin
          </button>

          <button
            type="button"
            className={
              showKlinger
                ? "active"
                : ""
            }
            onClick={() =>
              setShowKlinger(
                (value) =>
                  !value
              )
            }
          >
            Klinger
          </button>

        </div>

        <button
          className="save-button"
          type="button"
        >
          Save ▾
        </button>

      </div>

      {/* ===================================================
          SYMBOL INFORMATION
      =================================================== */}

      <div className="symbol-header">

        <div className="symbol-title">

          <span className="asset-icon">
            {symbol ===
            "BTCUSD"
              ? "₿"
              : symbol ===
                "ETHUSD"
              ? "Ξ"
              : symbol.includes(
                  "USD"
                )
              ? "$"
              : "●"}
          </span>

          <strong>
            {config.name}
          </strong>

          <span className="separator">
            ·
          </span>

          <span>
            {config.exchange}
          </span>

        </div>

        <div className="live-quote">

          <strong>
            {formatPrice(
              latest.close,
              config.decimals
            )}
          </strong>

          <span
            className={
              change >= 0
                ? "positive"
                : "negative"
            }
          >
            {change >= 0
              ? "+"
              : ""}
            {formatPrice(
              change,
              config.decimals
            )}

            {" ("}

            {changePercent >=
            0
              ? "+"
              : ""}

            {changePercent.toFixed(
              2
            )}

            {"%)"}
          </span>

        </div>

      </div>

      {/* ===================================================
          INDICATOR LEGEND
      =================================================== */}

      <div className="chart-legend">

        <span>
          Vol{" "}
          {formatCompact(
            latest.volume
          )}
        </span>

        {showEMA && (
          <>
            <span className="orange">
              EMA 20
            </span>

            <span className="purple">
              EMA 50
            </span>
          </>
        )}

      </div>

      {/* ===================================================
          CHART
      =================================================== */}

      <div
        ref={
          chartContainerRef
        }
        className="chart-container"
      />

      {/* ===================================================
          BOTTOM RANGE
      =================================================== */}

      <div className="chart-footer">

        <div className="range-buttons">

          {(
            [
              "1D",
              "5D",
              "1M",
              "3M",
              "6M",
              "YTD",
              "1Y",
              "5Y",
              "All",
            ] as Range[]
          ).map(
            (item) => (
              <button
                key={item}
                type="button"
                className={
                  range === item
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setRange(
                    item
                  )
                }
              >
                {item}
              </button>
            )
          )}

        </div>

        <div className="market-status">

          <span className="status-dot" />

          <span>
            {symbol} ·{" "}
            {timeframe}
          </span>

        </div>

      </div>

      {/* ===================================================
          TRADINGVIEW ATTRIBUTION
      =================================================== */}

      <div className="chart-attribution">

        Charts powered by{" "}
        <a
          href="https://www.tradingview.com/"
          target="_blank"
          rel="noreferrer"
        >
          TradingView
        </a>

      </div>

      {/* ===================================================
          ALL CSS — SAME FILE
      =================================================== */}

      <style jsx>{`

        * {
          box-sizing: border-box;
        }

        .trade-terminal {
          width: 100%;
          min-height: 880px;

          background:
            #0b0d10;

          color:
            #a7adb7;

          border:
            1px solid #252a32;

          border-radius:
            8px;

          overflow:
            hidden;

          font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        /* ===============================================
           TOOLBAR
        =============================================== */

        .trade-toolbar {
          height: 48px;

          display:
            flex;

          align-items:
            center;

          justify-content:
            space-between;

          padding:
            0 10px;

          background:
            #0b0d10;

          border-bottom:
            1px solid #20242c;
        }

        .toolbar-left {
          display:
            flex;

          align-items:
            center;

          gap:
            7px;

          min-width:
            0;
        }

        .icon-button {
          width:
            30px;

          height:
            32px;

          border:
            0;

          background:
            transparent;

          color:
            #d4d8df;

          font-size:
            20px;

          cursor:
            pointer;
        }

        .symbol-search {
          height:
            32px;

          display:
            flex;

          align-items:
            center;

          gap:
            6px;

          padding:
            0 6px;

          border-radius:
            4px;
        }

        .symbol-search:hover {
          background:
            #181c22;
        }

        .symbol-search span {
          color:
            #b6bdc8;

          font-size:
            18px;
        }

        .symbol-search select {
          appearance:
            none;

          border:
            0;

          outline:
            none;

          background:
            transparent;

          color:
            #e7e9ed;

          font-size:
            13px;

          font-weight:
            600;

          cursor:
            pointer;

          min-width:
            70px;
        }

        .symbol-search option {
          background:
            #11151a;

          color:
            white;
        }

        .plus-button {
          width:
            23px;

          height:
            23px;

          border:
            1px solid #4a515c;

          border-radius:
            50%;

          background:
            transparent;

          color:
            #d9dde4;

          cursor:
            pointer;

          font-size:
            16px;

          line-height:
            18px;
        }

        .timeframe-buttons {
          display:
            flex;

          align-items:
            center;

          border-left:
            1px solid #292e37;

          padding-left:
            5px;
        }

        .timeframe-buttons button {
          height:
            30px;

          padding:
            0 8px;

          border:
            0;

          border-radius:
            3px;

          background:
            transparent;

          color:
            #8e96a3;

          cursor:
            pointer;

          font-size:
            12px;
        }

        .timeframe-buttons button:hover,
        .timeframe-buttons button.active {
          background:
            #1c2129;

          color:
            #f2f4f7;
        }

        /* ===============================================
           INDICATOR BUTTONS
        =============================================== */

        .indicator-buttons {
          display:
            flex;

          align-items:
            center;

          gap:
            3px;

          margin-left:
            auto;

          margin-right:
            20px;
        }

        .indicator-buttons button {
          padding:
            7px 9px;

          border:
            0;

          border-radius:
            4px;

          background:
            transparent;

          color:
            #929aa7;

          cursor:
            pointer;

          font-size:
            11px;
        }

        .indicator-buttons button:hover,
        .indicator-buttons button.active {
          color:
            #e9ecf1;

          background:
            #1b2028;
        }

        .save-button {
          border:
            0;

          background:
            transparent;

          color:
            #d3d7de;

          cursor:
            pointer;

          font-size:
            12px;
        }

        /* ===============================================
           SYMBOL HEADER
        =============================================== */

        .symbol-header {
          height:
            44px;

          display:
            flex;

          align-items:
            center;

          justify-content:
            space-between;

          padding:
            0 12px;

          background:
            #0b0d10;

          border-bottom:
            1px solid #171b21;
        }

        .symbol-title {
          display:
            flex;

          align-items:
            center;

          gap:
            7px;

          white-space:
            nowrap;

          overflow:
            hidden;
        }

        .symbol-title strong {
          color:
            #dfe3e9;

          font-size:
            13px;

          font-weight:
            600;
        }

        .symbol-title span {
          color:
            #7e8794;

          font-size:
            12px;
        }

        .asset-icon {
          width:
            19px;

          height:
            19px;

          display:
            flex;

          align-items:
            center;

          justify-content:
            center;

          border-radius:
            50%;

          background:
            #1d232c;

          color:
            #dfe4ea !important;

          font-size:
            11px !important;

          font-weight:
            700;
        }

        .separator {
          color:
            #505864 !important;
        }

        .live-quote {
          display:
            flex;

          align-items:
            center;

          gap:
            10px;

          white-space:
            nowrap;
        }

        .live-quote strong {
          color:
            #dfe3e9;

          font-size:
            14px;
        }

        .live-quote span {
          font-size:
            12px;
        }

        .positive {
          color:
            #00c896 !important;
        }

        .negative {
          color:
            #ff4d67 !important;
        }

        /* ===============================================
           LEGEND
        =============================================== */

        .chart-legend {
          position:
            absolute;

          z-index:
            5;

          margin:
            9px 0 0 12px;

          display:
            flex;

          gap:
            13px;

          pointer-events:
            none;

          font-size:
            11px;

          color:
            #858d99;
        }

        .orange {
          color:
            #ff9f00;
        }

        .purple {
          color:
            #7c5cff;
        }

        /* ===============================================
           CHART
        =============================================== */

        .chart-container {
          width:
            100%;

          height:
            800px;
        }

        /* ===============================================
           FOOTER
        =============================================== */

        .chart-footer {
          height:
            40px;

          display:
            flex;

          align-items:
            center;

          justify-content:
            space-between;

          padding:
            0 12px;

          background:
            #0b0d10;

          border-top:
            1px solid #20242c;
        }

        .range-buttons {
          display:
            flex;

          align-items:
            center;

          gap:
            2px;
        }

        .range-buttons button {
          padding:
            5px 8px;

          border:
            0;

          border-radius:
            3px;

          background:
            transparent;

          color:
            #777f8c;

          cursor:
            pointer;

          font-size:
            11px;
        }

        .range-buttons button:hover,
        .range-buttons button.active {
          color:
            #eef0f3;

          background:
            #1b2028;
        }

        .market-status {
          display:
            flex;

          align-items:
            center;

          gap:
            7px;

          color:
            #69717e;

          font-size:
            10px;
        }

        .status-dot {
          width:
            6px;

          height:
            6px;

          border-radius:
            50%;

          background:
            #00c896;

          box-shadow:
            0 0 8px
            rgba(
              0,
              200,
              150,
              0.65
            );
        }

        /* ===============================================
           ATTRIBUTION
        =============================================== */

        .chart-attribution {
          padding:
            5px 10px;

          text-align:
            right;

          background:
            #080a0d;

          color:
            #535b67;

          font-size:
            9px;
        }

        .chart-attribution a {
          color:
            #69727f;

          text-decoration:
            none;
        }

        .chart-attribution a:hover {
          color:
            #9ca4b0;

          text-decoration:
            underline;
        }

        /* ===============================================
           RESPONSIVE
        =============================================== */

        @media (max-width: 1000px) {

          .indicator-buttons {
            display:
              none;
          }

        }

        @media (max-width: 700px) {

          .trade-toolbar {
            padding:
              0 6px;
          }

          .timeframe-buttons button:nth-child(
            1
          ),
          .timeframe-buttons button:nth-child(
            2
          ),
          .timeframe-buttons button:nth-child(
            3
          ) {
            display:
              none;
          }

          .symbol-title
          .separator {
            display:
              none;
          }

          .symbol-title
          span:not(.asset-icon) {
            display:
              none;
          }

          .chart-container {
            height:
              650px;
          }

          .chart-footer {
            overflow-x:
              auto;
          }

        }

        @media (max-width: 500px) {

          .timeframe-buttons button:nth-child(
            5
          ) {
            display:
              none;
          }

          .save-button {
            display:
              none;
          }

          .live-quote {
            gap:
              5px;
          }

          .live-quote span {
            display:
              none;
          }

        }

      `}</style>

    </div>
  );
}
