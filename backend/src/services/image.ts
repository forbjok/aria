import * as fs from "fs";
import * as path from "path";

import * as blake3 from "blake3";
import * as easyimg from "easyimage";

export interface ProcessImageResult {
  imageFilename: string;
  thumbFilename: string;
}

export class ImageService {
  private readonly imagePath: string;
  private readonly thumbPath: string;

  constructor(
    private readonly outputPath,
    private readonly imageSize: number = 500,
    private readonly thumbSize: number = 100,
    private readonly thumbBackground: string = "#D6DAF0"
  ) {
    this.imagePath = path.join(this.outputPath, "i");
    this.thumbPath = path.join(this.outputPath, "t");
  }

  public async processImage(src: string): Promise<ProcessImageResult> {
    // Calculate hash of the original file
    const hash = await hashFile(src);

    const imageFilename = `${hash}.webp`;
    const thumbFilename = `${hash}.webp`;

    const imagePath = path.join(this.imagePath, imageFilename);

    // Generate image if it does not exist
    if (!fs.existsSync(imagePath)) {
      await easyimg.resize({
        src,
        dst: imagePath,
        width: this.imageSize,
        height: this.imageSize,
        quality: 80,
        background: this.thumbBackground,
      });
    }

    const thumbPath = path.join(this.thumbPath, `${hash}.webp`);

    // Generate thumbnail if it does not exist
    await easyimg.resize({
      src,
      dst: thumbPath,
      width: this.thumbSize,
      height: this.thumbSize,
      quality: 80,
      background: this.thumbBackground,
    });

    return { imageFilename, thumbFilename };
  }
}

function hashFile(path: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    fs.createReadStream(path)
      .pipe(blake3.createHash())
      .on("data", (hash) => {
        resolve(hash.toString("hex"));
      })
      .on("error", (err) => reject(err));
  });
}
