import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { afterEach, describe, expect, it, vi } from "vitest"
import { TranslatePage } from "./TranslatePage"
import * as api from "@/lib/api"

function renderPage(initialEntries = ["/translate"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/translate" element={<TranslatePage />} />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe("TranslatePage", () => {
  it("renders the translator layout with title and controls", () => {
    renderPage()
    expect(screen.getByRole("heading", { level: 1, name: "Translate" })).toBeDefined()
    expect(screen.getByRole("combobox", { name: "Source language" })).toBeDefined()
    expect(screen.getByRole("combobox", { name: "Target language" })).toBeDefined()
    expect(screen.getByPlaceholderText(/Paste TTML XML, LRC, or plain lyrics here/)).toBeDefined()
  })

  it("loads lyrics from query params", () => {
    renderPage(["/translate?lyrics=%5B00%3A10.00%5D%20Hello%20world"])
    const textarea = screen.getByPlaceholderText(/Paste TTML XML, LRC, or plain lyrics here/) as HTMLTextAreaElement
    expect(textarea.value).toBe("[00:10.00] Hello world")
  })

  it("loads sample lyrics on clicking LRC Sample", () => {
    renderPage()
    const loadSampleBtn = screen.getByRole("button", { name: /lrc sample/i })
    fireEvent.click(loadSampleBtn)
    const textarea = screen.getByPlaceholderText(/Paste TTML XML, LRC, or plain lyrics here/) as HTMLTextAreaElement
    expect(textarea.value).toContain("夜に駆ける")
  })

  it("clears input on clicking Clear", () => {
    renderPage(["/translate?lyrics=some%20lyrics"])
    const clearBtn = screen.getByRole("button", { name: /clear/i })
    fireEvent.click(clearBtn)
    const textarea = screen.getByPlaceholderText(/Paste TTML XML, LRC, or plain lyrics here/) as HTMLTextAreaElement
    expect(textarea.value).toBe("")
  })

  it("calls translateLyrics and displays results with romanization and cards", async () => {
    const mockResult: api.TranslateResult = {
      lines: [
        { translation: "Night", romanization: "Yoru", needsTranslation: true },
      ],
      detectedLang: "ja",
      provider: "google-lyrics-translate",
      cached: true,
      translated: ["Night"],
      romanized: ["Yoru"],
    }
    const translateSpy = vi.spyOn(api, "translateLyrics").mockResolvedValue(mockResult)

    renderPage()
    const textarea = screen.getByPlaceholderText(/Paste TTML XML, LRC, or plain lyrics here/)
    fireEvent.change(textarea, { target: { value: "[00:12.34] 夜" } })

    const submitBtn = screen.getByRole("button", { name: "Translate" })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(translateSpy).toHaveBeenCalledTimes(1)
    })

    // Check payload passed: plain text "夜" without timestamp
    expect(translateSpy).toHaveBeenCalledWith(["夜"], "en", undefined)

    // Check output contains translated line and romanized line
    await waitFor(() => {
      expect(screen.getByText(/Japanese/)).toBeDefined()
      expect(screen.getByText(/\[00:12\.34\]Night/)).toBeDefined()
      expect(screen.getByText(/\[00:12\.34\]Yoru/)).toBeDefined()
    })
  })

  it("switches view modes between cards, raw text, and bilingual", async () => {
    const mockResult: api.TranslateResult = {
      lines: [
        { translation: "Hello", romanization: null, needsTranslation: true },
      ],
      detectedLang: "es",
      provider: "google-lyrics-translate",
      cached: false,
      translated: ["Hello"],
    }
    vi.spyOn(api, "translateLyrics").mockResolvedValue(mockResult)

    renderPage()
    const textarea = screen.getByPlaceholderText(/Paste TTML XML, LRC, or plain lyrics here/)
    fireEvent.change(textarea, { target: { value: "[00:05.00] Hola" } })

    const submitBtn = screen.getByRole("button", { name: "Translate" })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /raw/i })).toBeDefined()
    })

    // Switch to Raw Text
    fireEvent.click(screen.getByRole("button", { name: /raw/i }))
    const rawTextarea = screen.getByDisplayValue("[00:05.00]Hello")
    expect(rawTextarea).toBeDefined()

    // Switch to Bilingual
    fireEvent.click(screen.getByRole("button", { name: /bilingual/i }))
    expect(screen.getByText("[00:05.00] Hola")).toBeDefined()
    expect(screen.getByText("[00:05.00]Hello")).toBeDefined()
  })

  it("preserves LRC header tags intact without translating them", async () => {
    const mockResult: api.TranslateResult = {
      lines: [
        { translation: null, romanization: null, needsTranslation: false },
        { translation: "World", romanization: null, needsTranslation: true },
      ],
      detectedLang: "es",
      provider: "google-lyrics-translate",
      cached: false,
      translated: ["", "World"],
    }
    const translateSpy = vi.spyOn(api, "translateLyrics").mockResolvedValue(mockResult)

    renderPage()
    const textarea = screen.getByPlaceholderText(/Paste TTML XML, LRC, or plain lyrics here/)
    fireEvent.change(textarea, { target: { value: "[ti:My Song]\n[00:10.00] Mundo" } })

    const submitBtn = screen.getByRole("button", { name: "Translate" })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(translateSpy).toHaveBeenCalledWith(["", "Mundo"], "en", undefined)
    })

    await waitFor(() => {
      expect(screen.getByText("[ti:My Song]")).toBeDefined()
      expect(screen.getByText("[00:10.00]World")).toBeDefined()
    })
  })

  it("parses TTML XML and extracts lyric text from <p> paragraphs", async () => {
    const ttmlSample = `<tt xmlns="http://www.w3.org/ns/ttml">
      <body>
        <div>
          <p begin="00:15.200" end="00:18.900">沈むように溶けてゆくように</p>
        </div>
      </body>
    </tt>`

    const mockResult: api.TranslateResult = {
      lines: [
        { translation: "As if sinking, as if melting", romanization: "Shizumu you ni", needsTranslation: true },
      ],
      detectedLang: "ja",
      provider: "google-lyrics-translate",
      cached: true,
      translated: ["As if sinking, as if melting"],
      romanized: ["Shizumu you ni"],
    }
    const translateSpy = vi.spyOn(api, "translateLyrics").mockResolvedValue(mockResult)

    renderPage()
    const textarea = screen.getByPlaceholderText(/Paste TTML XML, LRC, or plain lyrics here/)
    fireEvent.change(textarea, { target: { value: ttmlSample } })

    expect(screen.getByText("ttml")).toBeDefined()

    const submitBtn = screen.getByRole("button", { name: "Translate" })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(translateSpy).toHaveBeenCalledWith(["沈むように溶けてゆくように"], "en", undefined)
    })

    await waitFor(() => {
      expect(screen.getByText("[00:15.20]As if sinking, as if melting")).toBeDefined()
    })
  })
})
