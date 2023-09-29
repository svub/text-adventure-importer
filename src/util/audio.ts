import { ResultReason, SpeechConfig, SpeechSynthesisOutputFormat, SpeechSynthesizer } 
  from "microsoft-cognitiveservices-speech-sdk";

export type TextAndFilename = {
  text: string;
  filename: string;
}

export function createSynthesizer(key, region, voice) {
  const speechConfig = SpeechConfig.fromSubscription(key, region);
  speechConfig.speechSynthesisOutputFormat = SpeechSynthesisOutputFormat.Audio48Khz96KBitRateMonoMp3;
  speechConfig.speechSynthesisVoiceName = voice;
  return new SpeechSynthesizer(speechConfig);
}

export async function synthesizeAudio(text: string, synthesizer: SpeechSynthesizer) {
  const result = new Promise<{ data: ArrayBuffer; message: string }>((resolve, reject) => {
    synthesizer.speakTextAsync(text,
      result => {
        if (result.reason === ResultReason.SynthesizingAudioCompleted) {
          resolve({
            data: result.audioData,
            message: `Synthesis successful. Audio data: ${result.audioData.byteLength} bytes.`
          });
        } else if (result.reason === ResultReason.Canceled) {
          reject("Synthesis failed. Error detail: " + result.errorDetails);
        }
        reject("Unknown error " + result);
      },
      err => reject("Error: " + err));
  });
  return result;
}