import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import nodemailer from "nodemailer";
import { dayjs } from "../lib/dayjs";
import { getMailClient } from "../lib/mail";
import { ClientError } from "../errors/client-error";
import { env } from "../env";

export async function createInvite(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    "/trips/:tripId/invites",
    {
      schema: {
        params: z.object({
          tripId: z.string().uuid(),
        }),
        body: z.object({
          email: z.string().email(),
        }),
      },
    },
    async (request) => {
      const { tripId } = request.params;

      const { email } = request.body;

      const trip = await prisma.trip.findUnique({
        where: {
          id: tripId,
        },
      });

      if (!trip) {
        throw new ClientError("Trip not foound!");
      }

      const participant = await prisma.participant.create({
        data: {
          email,
          trip_id: tripId,
        },
      });

      const formattedStartDate = dayjs(trip.starts_at).format("LL");
      const formattedEndDate = dayjs(trip.ends_at).format("LL");

      const mail = await getMailClient();

      const confirmationLink = `${env.API_BASE_URL}/participants/${participant.id}/confirm`;

      const message = await mail.sendMail({
        from: {
          name: "Equipe plan.ner",
          address: "planner@hausha.com",
        },
        to: participant.email,
        subject: `Confirme sua presença na viagem para ${trip.destination}`,
        html: `
            <div>
                <p> Você foi convidade para uma viagem para <strong>${trip.destination}</strong> nas datas <strong>${formattedStartDate}</strong> até <strong>${formattedEndDate}</strong>
            </div>
            <p>
                <a href=${confirmationLink}>Confirmar viagem </a>
            </p>
            `.trim(),
      });
      console.log(nodemailer.getTestMessageUrl(message));

      return {
        participantId: participant.id,
      };
    }
  );
}
