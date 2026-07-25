import { Camera, LoaderCircle, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ImageAssessment } from "../providers/types";

interface ImageCheckpointProps {
  open: boolean;
  defaultQuestion: string;
  uploadPrompt: string;
  showTestKitchenImages?: boolean;
  onClose(): void;
  onAnalyze(file: File, question: string): Promise<ImageAssessment>;
}

const TEST_KITCHEN_IMAGES = [
  {
    label: "Partially seared steak",
    source: "/recipe-steps/04-sear-first-side-1200.jpg",
    fileName: "partially-seared-steak.jpg"
  }
] as const;

export function ImageCheckpoint({
  open,
  defaultQuestion,
  uploadPrompt,
  showTestKitchenImages = false,
  onClose,
  onAnalyze
}: ImageCheckpointProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File>();
  const [question, setQuestion] = useState(defaultQuestion);
  const [result, setResult] = useState<ImageAssessment>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingTestImage, setLoadingTestImage] = useState(false);
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : ""), [file]);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl]
  );

  useEffect(() => {
    setQuestion(defaultQuestion);
    setFile(undefined);
    setResult(undefined);
    setError("");
    setLoading(false);
    setLoadingTestImage(false);
    if (fileInput.current) fileInput.current.value = "";
  }, [defaultQuestion, open]);

  if (!open) return null;

  async function analyze() {
    if (!file) {
      setError("Choose a photo first.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      setResult(await onAnalyze(file, question));
    } catch (analysisError) {
      setError(
        analysisError instanceof Error ? analysisError.message : "Image analysis failed."
      );
    } finally {
      setLoading(false);
    }
  }

  async function selectTestKitchenImage(
    image: (typeof TEST_KITCHEN_IMAGES)[number]
  ) {
    setError("");
    setResult(undefined);
    setLoadingTestImage(true);
    try {
      const response = await fetch(image.source);
      if (!response.ok) throw new Error("The Test Kitchen image could not be loaded.");
      const blob = await response.blob();
      setFile(
        new File([blob], image.fileName, {
          type: blob.type || "image/jpeg"
        })
      );
      if (fileInput.current) fileInput.current.value = "";
    } catch (selectionError) {
      setError(
        selectionError instanceof Error
          ? selectionError.message
          : "The Test Kitchen image could not be loaded."
      );
    } finally {
      setLoadingTestImage(false);
    }
  }

  return (
    <div className="checkpoint-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="checkpoint"
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkpoint-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span>Visual checkpoint</span>
            <h2 id="checkpoint-title">Does this look right?</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close image checkpoint">
            <X />
          </button>
        </header>

        {!result ? (
          <>
            {showTestKitchenImages && (
              <section className="test-kitchen-selector" aria-label="Test Kitchen images">
                <div>
                  <span>Test Kitchen</span>
                  <small>Development shortcut</small>
                </div>
                {TEST_KITCHEN_IMAGES.map((image) => (
                  <button
                    type="button"
                    key={image.source}
                    onClick={() => void selectTestKitchenImage(image)}
                    disabled={loadingTestImage}
                  >
                    <img src={image.source} alt="" />
                    <strong>
                      {loadingTestImage ? "Loading image…" : image.label}
                    </strong>
                  </button>
                ))}
              </section>
            )}

            <button
              className={`checkpoint__upload ${previewUrl ? "has-image" : ""}`}
              type="button"
              onClick={() => fileInput.current?.click()}
            >
              {previewUrl ? (
                <img src={previewUrl} alt="Selected cooking checkpoint" />
              ) : (
                <>
                  <Camera />
                  <strong>{uploadPrompt}</strong>
                  <span>Camera or photo library</span>
                </>
              )}
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={(event) => {
                setFile(event.target.files?.[0]);
                setResult(undefined);
                setError("");
              }}
            />

            <label className="checkpoint__question">
              <span>Ask Mise</span>
              <input value={question} onChange={(event) => setQuestion(event.target.value)} />
            </label>

            {error && <p className="form-error">{error}</p>}
            <button
              className="primary-action checkpoint__analyze"
              type="button"
              onClick={analyze}
              disabled={loading || loadingTestImage}
            >
              <span>{loading ? "Looking closely…" : "Check with Gemini"}</span>
              {loading && <LoaderCircle className="spinner" />}
            </button>
          </>
        ) : (
          <div className="assessment">
            {result.isMock && (
              <span className="assessment__mode">Local preview</span>
            )}
            <div>
              <span>What I can see</span>
              <p>{result.assessment}</p>
            </div>
            <div>
              <span>Do this now</span>
              <strong>{result.nextAction}</strong>
            </div>
            {result.safetyNote && (
              <div className="assessment__safety">
                <span>Safety</span>
                <p>{result.safetyNote}</p>
              </div>
            )}
            <button className="secondary-action" type="button" onClick={() => setResult(undefined)}>
              Check another photo
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
