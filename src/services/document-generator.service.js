import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import {
  AlignmentType,
  Document,
  HeadingLevel,
  PageNumber,
  Packer,
  Paragraph,
  TabStopPosition,
  TabStopType,
  TextRun,
  UnderlineType,
} from 'docx';

const FONT_FAMILY = 'Times New Roman';
const DEFAULT_SIZE = 26;
const LONG_DOTS = '................................................................................';

const dots = (value, fallback = '.................................') => {
  const text = String(value ?? '').trim();
  return text || fallback;
};

const run = ({ text = '', bold = false, italics = false, underline = false, size = DEFAULT_SIZE } = {}) =>
  new TextRun({
    text,
    bold,
    italics,
    size,
    font: FONT_FAMILY,
    underline: underline ? { type: UnderlineType.SINGLE } : undefined,
  });

const currentDateParts = () => {
  const now = new Date();
  return {
    day: String(now.getDate()).padStart(2, '0'),
    month: String(now.getMonth() + 1).padStart(2, '0'),
    year: String(now.getFullYear()),
  };
};

const line = ({ text, bold = false, italics = false, underline = false, size = DEFAULT_SIZE, after = 100, firstLine = 0 } = {}) =>
  new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { after, line: 320 },
    indent: firstLine ? { firstLine } : undefined,
    children: [
      run({ text, bold, italics, underline, size }),
    ],
  });

const centered = ({ text, bold = false, italics = false, underline = false, size = DEFAULT_SIZE, after = 100 } = {}) =>
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after, line: 320 },
    children: [
      run({ text, bold, italics, underline, size }),
    ],
  });

const rightAligned = ({ text, italics = false, size = DEFAULT_SIZE, after = 100 } = {}) =>
  new Paragraph({
    alignment: AlignmentType.RIGHT,
    spacing: { after, line: 320 },
    children: [
      run({ text, italics, size }),
    ],
  });

const dottedInfoLine = (label, value, suffix = '', fallback = LONG_DOTS) =>
  new Paragraph({
    spacing: { after: 100, line: 320 },
    tabStops: [
      { type: TabStopType.LEFT, position: TabStopPosition.MAX / 2 },
    ],
    children: [run({ text: `${label}${dots(value, fallback)}${suffix}` })],
  });

const buildDocument = (report = {}) => {
  const reporter = report.reporterInfo ?? {};
  const suspect = report.suspectInfo ?? {};
  const date = currentDateParts();

  return new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,
              right: 1440,
              bottom: 1440,
              left: 1800,
            },
            pageNumbers: {
              start: 1,
              formatType: PageNumber.DECIMAL,
            },
          },
        },
        children: [
          centered({ text: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', bold: true, size: 28, after: 40 }),
          centered({ text: 'Độc lập - Tự do - Hạnh phúc', bold: true, underline: true, size: 26, after: 220 }),
          rightAligned({ text: `................, ngày ${date.day} tháng ${date.month} năm ${date.year}`, italics: true, after: 320 }),
          centered({ text: 'ĐƠN TỐ GIÁC TỘI PHẠM', bold: true, size: 30, after: 100 }),
          centered({ text: `(Về hành vi ${dots(report.crimeType)}) (1)`, bold: true, size: 26, after: 260 }),
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { after: 220, line: 320 },
            children: [
              run({ text: 'Kính gửi: ', bold: true }),
              run({ text: `Cơ quan điều tra, Công an quận/huyện ${dots(report.recipientAuthority)} (2)` }),
            ],
          }),
          dottedInfoLine('Tôi tên là: ', reporter.fullName, `\tSinh năm: ${dots(reporter.birthYear, '...............')}`),
          dottedInfoLine('CMND số: ', reporter.identityNumber, ` do: ${dots(reporter.idIssuedBy)} cấp ngày: ${dots(reporter.idIssuedDate)}`),
          dottedInfoLine('Hộ khẩu thường trú: ', reporter.permanentAddress, '', LONG_DOTS),
          dottedInfoLine('Hiện đang cư ngụ tại: ', reporter.currentAddress, '', LONG_DOTS),
          new Paragraph({ spacing: { after: 120 } }),
          line({
            text: 'Nay tôi làm đơn này kính mong quý cơ quan tiến hành điều tra làm rõ hành vi vi phạm của đối tượng:',
            italics: true,
            firstLine: 480,
          }),
          dottedInfoLine('Họ và tên: ', suspect.name),
          dottedInfoLine('Hiện đang cư ngụ tại: ', suspect.currentAddress, '', LONG_DOTS),
          dottedInfoLine('Đối tượng này đã có hành vi (3) ', report.crimeDescription, '', LONG_DOTS),
          dottedInfoLine('Chứng cứ chứng minh (nếu có) (4): ', report.evidence, '', LONG_DOTS),
          new Paragraph({ spacing: { after: 120 } }),
          line({
            text: 'Từ vụ việc xảy ra nêu trên, tôi cho rằng cá nhân này đã có hành vi vi phạm pháp luật. Kính đề nghị quý cơ quan điều tra làm rõ hành vi trên để đảm bảo tình hình an ninh, xã hội trên địa bàn.',
            firstLine: 480,
          }),
          line({
            text: 'Tôi xin cam kết những gì tôi vừa trình bày là sự thật và hoàn toàn chịu trách nhiệm trước pháp luật về những gì tôi vừa nêu.',
            firstLine: 480,
          }),
          line({ text: 'Xin chân thành cảm ơn./.', firstLine: 480, after: 300 }),
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { after: 80, line: 320 },
            children: [run({ text: 'Người tố giác', bold: true })],
          }),
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { after: 560, line: 320 },
            children: [run({ text: '(Ký, ghi rõ họ tên)', italics: true })],
          }),
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { after: 80, line: 320 },
            children: [run({ text: dots(reporter.fullName, '.........................'), bold: true })],
          }),
        ],
      },
    ],
  });
};

export const generateToGiacDocument = async (report = {}) => {
  const filename = `Don_To_Giac_${report.reportCode || Date.now()}.docx`;
  const doc = buildDocument(report);
  const buffer = await Packer.toBuffer(doc);
  return { buffer, filename };
};

export const storeGeneratedDocument = async (report = {}) => {
  const generated = await generateToGiacDocument(report);
  const filePath = path.join(os.tmpdir(), generated.filename);
  await fs.writeFile(filePath, generated.buffer);
  return {
    ...generated,
    filePath,
  };
};

export const readStoredDocument = async (filename) => {
  const filePath = path.join(os.tmpdir(), filename);
  const buffer = await fs.readFile(filePath);
  return { buffer, filePath, filename };
};
