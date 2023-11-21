import { AudioConfig, AudioOutputStream, ResultReason, SpeechConfig, SpeechSynthesisOutputFormat, SpeechSynthesizer }
  from "microsoft-cognitiveservices-speech-sdk";

export type TextAndFilename = {
  text: string;
  filename: string;
}

export async function synthesizeAudio(text: string, key: string, region: string, voice: string) {
  const speechConfig = SpeechConfig.fromSubscription(key, region);
  speechConfig.speechSynthesisOutputFormat = SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3;
  speechConfig.speechSynthesisVoiceName = voice;
  const stream = AudioOutputStream.createPullStream();
  const audioConfig = AudioConfig.fromStreamOutput(stream); // avoiding automatic playback;
  const synthesizer = new SpeechSynthesizer(speechConfig, audioConfig);

  return new Promise<{ data: ArrayBuffer; message: string }>((resolve, reject) => {
    synthesizer.speakTextAsync(text,
      async result => {
        if (result.reason === ResultReason.SynthesizingAudioCompleted) {
          // eslint-disable-next-line no-constant-condition
          while (true) {
            if (await stream.read(new ArrayBuffer(102400)) < 1) break;
          }
          synthesizer.close();
          return resolve({
            data: result.audioData,
            message: `Synthesis successful. Audio data: ${result.audioData.byteLength} bytes.`
          });
        } else if (result.reason === ResultReason.Canceled) {
          return reject("Synthesis canceled. Error detail: " + result.errorDetails);
        }
        reject("Unknown error: " + result);
      },
      err => reject("Error: " + err),
      stream); // give stream to avoid playback on speakers
  });

}