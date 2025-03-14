import React from "react";
import { LottieWrapper } from "~/components/lottie-wrapper";
import successfullScanAnimation from "../../lottie/success-scan.json";

export default function SuccessAnimation() {
  return (
    <LottieWrapper
      animationData={successfullScanAnimation}
      loop={false}
      style={{ width: 200, height: 200 }}
    />
  );
}