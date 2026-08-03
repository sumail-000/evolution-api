import { ConfigService, Database } from '@config/env.config';
import { Logger } from '@config/logger.config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

export class Query<T> {
  where?: T;
  sort?: 'asc' | 'desc';
  page?: number;
  offset?: number;
}

// Prisma 7 exige driver adapter. Seleciona o adapter conforme DATABASE_PROVIDER.
function createPrismaAdapter(connectionString: string) {
  const provider = process.env.DATABASE_PROVIDER ?? 'postgresql';
  if (provider === 'mysql') {
    return new PrismaMariaDb(connectionString);
  }
  // postgresql e psql_bouncer usam o adapter do Postgres.
  // O driver pg IGNORA o parâmetro ?schema= do Prisma — o migrate respeita e
  // aplica em evolution_api, mas o runtime cairia em public e nenhuma tabela
  // seria encontrada ("RuntimeConfig table was not found"). Extrai o schema da
  // URI e entrega ao adapter, que o usa nas queries geradas.
  let schema: string | undefined;
  try {
    schema = new URL(connectionString).searchParams.get('schema') ?? undefined;
  } catch {
    // URI fora do formato URL — segue sem schema explícito
  }
  return new PrismaPg(connectionString, schema ? { schema } : undefined);
}

export class PrismaRepository extends PrismaClient {
  constructor(private readonly configService: ConfigService) {
    super({ adapter: createPrismaAdapter(configService.get<Database>('DATABASE').CONNECTION.URI) });
  }

  private readonly logger = new Logger('PrismaRepository');

  public async onModuleInit() {
    await this.$connect();
    this.logger.info('Repository:Prisma - ON');
  }

  public async onModuleDestroy() {
    await this.$disconnect();
    this.logger.warn('Repository:Prisma - OFF');
  }
}
