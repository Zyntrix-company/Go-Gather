import client from './client';

export type PlacePrediction = {
  place_id: string;
  description: string;
};

/** Location autocomplete, proxied through the backend (which holds the Google Places key). */
export async function autocompletePlaces(input: string): Promise<PlacePrediction[]> {
  const { data } = await client.get<{ predictions: PlacePrediction[] }>('/places/autocomplete', {
    params: { input },
  });
  return data.predictions ?? [];
}
