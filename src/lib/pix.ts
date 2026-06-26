function emvField(id: string, value: string) {
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

function crc16(payload: string) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) crc = (crc << 1) ^ 0x1021;
      else crc <<= 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function generatePixCopiaECola(options: {
  pixKey: string;
  merchantName: string;
  merchantCity: string;
  amount: number;
  txId?: string;
}) {
  const txId = (options.txId ?? "CORTECERTO")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 25)
    .toUpperCase();

  const merchantAccount = emvField(
    "26",
    emvField("00", "br.gov.bcb.pix") + emvField("01", options.pixKey)
  );

  const payloadWithoutCrc = [
    emvField("00", "01"),
    merchantAccount,
    emvField("52", "0000"),
    emvField("53", "986"),
    emvField("54", options.amount.toFixed(2)),
    emvField("58", "BR"),
    emvField("59", options.merchantName.slice(0, 25).toUpperCase()),
    emvField("60", options.merchantCity.slice(0, 15).toUpperCase()),
    emvField("62", emvField("05", txId)),
  ].join("");

  const crc = crc16(`${payloadWithoutCrc}6304`);
  return `${payloadWithoutCrc}6304${crc}`;
}
