import { createEmptyPassInput } from "@/lib/wallet/common/defaults";
import type { CommonPassInputParsed } from "@/lib/wallet/common/validation";

/** Default Greenback coupon pass starter values for the pass builder. */
export function createGreenbackPassInput(): Omit<CommonPassInputParsed, "userId"> & { serialNumber: string } {
  return {
    ...createEmptyPassInput({
      name: "Greenback Offer",
      passType: "coupon",
      organization: {
        name: "Greenback",
        description: "Offer by Greenback",
        logoText: "Greenback",
      },
      appearance: {
        backgroundColor: "#082868",
        foregroundColor: "#FFFFFF",
        labelColor: "#B8D4FF",
        logo: null,
        strip: null,
        thumbnail: null,
        background: null,
      },
      fields: {
        header: [{ key: "header", label: "Offer", value: "#001", textAlignment: "left", sortOrder: 0 }],
        primary: [{ key: "primary", label: "Coupon", value: "", textAlignment: "left", sortOrder: 0 }],
        secondary: [],
        auxiliary: [{ key: "field_1", label: "Expires", value: "", textAlignment: "left", sortOrder: 0 }],
        back: [],
      },
      barcode: { type: "QR", value: "", altText: "" },
      validity: {
        relevantDate: null,
        expirationDate: null,
        validFrom: null,
        validUntil: null,
        relevantDateEnabled: false,
        expirationDateEnabled: false,
        validFromEnabled: false,
        validUntilEnabled: false,
      },
      locations: [],
    }),
    serialNumber: "",
    status: "draft",
  };
}
