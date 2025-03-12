import * as QRCode from 'qrcode';

export const generateQRCode = async (link: string): Promise<string> => {
  try {
    return await QRCode.toDataURL(link);
  } catch (error) {
    console.error('Error generating QR Code:', error);
    throw new Error('Failed to generate QR Code');
  }
};
