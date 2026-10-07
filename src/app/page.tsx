import { connection } from "next/server";
import { Suspense } from "react";

import { PreloadQuery } from "@/apollo";
import { Library } from "@/Library";
import { LIBRARY } from "@/operations";

export default async function Home() {
  await connection();

  return (
    <PreloadQuery query={LIBRARY}>
      {(queryRef) => (
        <Suspense fallback={<p>Loading library...</p>}>
          <Library queryRef={queryRef} />
        </Suspense>
      )}
    </PreloadQuery>
  );
}
