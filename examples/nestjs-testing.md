# Testing while developing TWD - NestJS example

In this article, we’ll apply the [TWD mindset](https://dev.to/kevinccbsg/rethinking-testing-why-i-test-while-developing-3pi1) to a NestJS project.

We’ll simulate a scenario where you're a new developer joining a project, tasked with building a new feature — but this time, using the TWD approach.

## What’s TWD again?

Before we dive into code, a quick reminder of some TWD principles:

- Add automated tests right after identifying a manual test while developing a feature.
- Keep your test runner open during development to get feedback instantly.
- Use coverage after completing the feature to spot gaps, not as a goal.

You don’t write all tests first (like TDD), and you don’t leave testing for "after everything works". You test while building.

## Step 1: Create a NestJS project

Let’s start with a fresh NestJS project:

```ts
npm i -g @nestjs/cli
nest new nestjs-twd-example
```

## Define the feature

To keep the focus on TWD, we’ll implement a simple TODO API with two endpoints:

- `POST /todos`: Create a TODO item.
- `GET /todos`: Retrieve the list of TODOs.

## Getting Started with TWD

[NestJS](https://nestjs.com/) includes [Jest](https://jestjs.io/) out of the box for testing.
Some people prefer changing it to Vitest, but honestly, Jest is more than good enough for now. Don’t waste time switching tools if they’re not the bottleneck.

By default, Nest provides an example test at `test/app.e2e-spec.ts`.
Let’s take a look:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });
});
```

Now let’s keep the tests running as we work:

```
npm run test:e2e -- --watch
```

Press `p` to select `test/app.e2e-spec.ts` and keep it running in the background.
That’s **TWD principle #2**: keep feedback close.

## Let’s Build the Feature

Let’s add the `POST /todos` endpoint in `src/app.controller.ts`:

```ts
import { Controller, Post } from '@nestjs/common';
import { AppService } from './app.service';

@Controller({
  path: 'todos',
})
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post()
  createTodo() {
    return { success: true };
  }
}
```

Now, if we take a look at our tests, they fail. So before jumping into database integration, let’s fix them first. I know—we’re tempted to keep going with the feature, but this will only take a few lines.

```ts
describe('TODO API (e2e)', () => {
  // ...

  it('/todos (POST)', () => {
    return request(app.getHttpServer())
      .post('/todos')
      .expect(201)
      .expect({ success: true });
  });
});
```

Let’s also connect our controller with the service in `src/app.service.ts`, like this:

```ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  createTodo() {
    return { success: true };
  }
}
```

And update the controller accordingly:

```ts
import { Controller, Post } from '@nestjs/common';
import { AppService } from './app.service';

@Controller({
  path: 'todos',
})
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post()
  createTodo() {
    return this.appService.createTodo();
  }
}
```

Just a tiny bit of refactor — and tests still pass.


![test ok](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/p6578mdwlbfp4rpd9ok7.png)

No need to open Postman or curl it again. We’re getting feedback as we build.

## Adding the Database

Now comes the database. Let’s try a **TDD** approach… but wait.
We don’t even have the ORM or DB set up. Writing a failing test here is frustrating.
This is why TWD is flexible — add tests when they make sense, not to follow a strict order.

Install TypeORM and SQLite:

```bash
npm install --save @nestjs/typeorm typeorm sqlite3
```

Update `app.module.ts`:

```ts{9-15}
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Todo } from './entities/todos.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type :"sqlite",
      database: "todoDB",
      entities: [__dirname + "/**/*.entity{.ts,.js}"],
      synchronize: true
    }),
    TypeOrmModule.forFeature([Todo])
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

> We also need to include the `todoDB` in the `.gitignore` file

Create `src/entities/todos.entity.ts`:

```ts
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class Todo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;
}
```

Update the service `src/app.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { Todo } from './entities/todos.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class AppService {
  constructor(
    @InjectRepository(Todo)
    private todoRepository: Repository<Todo>,
  ) {}
  async createTodo(title: string) {
    const todo = this.todoRepository.create({ title });
    await this.todoRepository.save(todo);
    return { success: true };
  }
}
```

Update controller to accept `title`:

```ts{11-13}
import { Body, Controller, Post } from '@nestjs/common';
import { AppService } from './app.service';

@Controller({
  path: 'todos',
})
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post()
  createTodo(@Body() body: { title: string }) {
    return this.appService.createTodo(body.title);
  }
}
```

## Testing DB Integration

At this point, what we would normally do is a manual test — use a tool like Postman to hit the endpoint, then check in a DB client like DBeaver to see if the data was stored.

But think about that:
Why spend time doing something manually that requires two different pieces of software, can’t be reused, and isn’t even automated?

Why not just do it directly in the test file?

Let’s do that.

We’ll first modify our test to send a payload to create a TODO:

```ts
it('/todos (POST)', () => {
  const title = 'test';
  return request(app.getHttpServer())
    .post('/todos')
    .send({ title })
    .expect(201)
    .expect({ success: true });
});
```

Now, when we run this, it passes — great.
But what about the **database**? That’s not a complete test.

In TWD, when we deal with a DB, the idea is that our test should:

- Clean up any leftover state
- Validate the data was persisted correctly

So we need our test to access the database. In NestJS, we can get the repository like this:

```ts{1,9}
let todoRepository: Repository<Todo>;

beforeEach(async () => {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleFixture.createNestApplication();
  todoRepository = moduleFixture.get<Repository<Todo>>(getRepositoryToken(Todo));
  await app.init();
});
```

With that in place, we can now assert that the data was actually stored:

```ts{9-11}
it('/todos (POST)', async () => {
  const title = 'test';
  await request(app.getHttpServer())
    .post('/todos')
    .send({ title })
    .expect(201)
    .expect({ success: true });

  const todos = await todoRepository.find();
  expect(todos).toHaveLength(1);
  expect(todos[0].title).toBe(title);
});
```

Nice — but there's a catch.

If we run this test multiple times, it starts to fail. Why? Because the database keeps old data. That means the test isn't isolated — and that breaks a core testing principle.

To fix this, we add cleanup logic in an `afterEach`:

```ts
afterEach(async () => {
  await todoRepository.clear();
});
```

Now we have a complete test:

- It creates data
- Validates the result
- Cleans up after itself

Here’s the full file:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { Repository } from 'typeorm';
import { Todo } from './../src/entities/todos.entity';
import { getRepositoryToken } from '@nestjs/typeorm';

describe('TODO API (e2e)', () => {
  let app: INestApplication<App>;
  let todoRepository: Repository<Todo>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    todoRepository = moduleFixture.get<Repository<Todo>>(getRepositoryToken(Todo));
    await app.init();
  });

  afterEach(async () => {
    await todoRepository.clear();
  });

  it('/todos (POST)', async () => {
    const title = 'test';
    await request(app.getHttpServer())
      .post('/todos')
      .send({ title })
      .expect(201)
      .expect({ success: true });

    const todos = await todoRepository.find();
    expect(todos).toHaveLength(1);
    expect(todos[0].title).toBe(title);
  });
});
```

That’s it. Just by hitting Enter in the terminal, we’ve automated what we’d otherwise do by hand — call the endpoint, then check the DB.

And now we have confidence to **refactor**.
We could change the controller, move logic to services, or even switch to DDD or hexagonal architecture — and still know everything works.

The test is no longer just a check. It's:

- a safety net for change
- documentation of behavior
- proof that the feature works

## Feature /Get todos

Now let’s build a new feature: list all TODOs.
At this point, we already know how to:

- Test endpoints
- Validate DB data
- Clean up state

So… why not just copy/paste our previous test and tweak it?

**Option 1**: Use the POST endpoint

```ts
it('/todos (GET)', async () => {
  const title = 'test';
  await request(app.getHttpServer())
    .post('/todos')
    .send({ title })
    .expect(201)
    .expect({ success: true });

  const response = await request(app.getHttpServer())
    .get('/todos')
    .expect(200);

  expect(response.body).toHaveLength(1);
  expect(response.body[0].title).toBe(title);
});
```

**Option 2**: Seed the DB directly

```ts
it('/todos (GET) - with data', async () => {
  const title = 'test';
  await todoRepository.save({ title });

  const response = await request(app.getHttpServer())
    .get('/todos')
    .expect(200);

  expect(response.body).toHaveLength(1);
  expect(response.body[0].title).toBe(title);
});
```

Which one you pick depends on your style. But both are valid in TWD.

Now let’s implement the feature itself.

Update `src/app.controller.ts`:

```ts{15-18}
import { Body, Controller, Get, Post } from '@nestjs/common';
import { AppService } from './app.service';

@Controller({
  path: 'todos',
})
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post()
  createTodo(@Body() body: { title: string }) {
    return this.appService.createTodo(body.title);
  }

  @Get()
  getTodos() {
    return this.appService.getTodos();
  }
}
```

And update `src/app.service.ts`:

```ts{18-21}
import { Injectable } from '@nestjs/common';
import { Todo } from './entities/todos.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class AppService {
  constructor(
    @InjectRepository(Todo)
    private todoRepository: Repository<Todo>,
  ) {}
  async createTodo(title: string) {
    const todo = this.todoRepository.create({ title });
    await this.todoRepository.save(todo);
    return { success: true };
  }

  async getTodos() {
    const todos = await this.todoRepository.find();
    return todos;
  }
}
```

Done.
Run the tests — they pass.

Notice how this second endpoint ended up closer to TDD — we started from the test.
But we didn’t try to define all edge cases or write abstract specs.

We just **automated what we’d do manually** — and did it early. That’s the essence of TWD.

## Conclusion

Many developers finish the feature and move on — no tests, or maybe one thrown in later. But at that point, writing tests feels like a chore.

**TWD flips that around:**
You’re just automating what you’d manually do anyway — and doing it while building, not after.

In fact, it saved us time:

- No Postman
- No SQL client
- No manual validations
- No need to rerun tests by hand

This was a simple example — but the idea **scales**.
And if your API or architecture feels _too complex to test this way_… maybe it's worth asking **why**. A design that can’t be tested easily might not be a great design.

Also — **TWD isn’t rigid**. You can still use Postman, a SQL client, or poke around in the UI. This approach just helps you capture what works, build confidence in your code, and make future changes safer — all without slowing you down.

---

In future posts, I’ll cover:

- Handling external service dependencies (with mocks/spies)
- How TWD works on frontend apps (spoiler: harder, but worth it)

Thanks for reading! Repo with the code [here](https://github.com/kevinccbsg/nestjs-twd-example).
