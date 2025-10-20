export const faqEnterpriseData = [
  {
    topic:
      "How does the Enterprise plan differ from the Individual/Business plans, and why should my company pay for it?",
    answer:
      "The Enterprise plan transforms Radon IDE from a tool into a comprehensive solution, offering centralized management, advanced security, and simplified billing at scale. It provides a strategic partnership with priority technical support (SLA) and direct influence on product development, minimizing risk and maximizing team productivity. Enterprise customers also get access to exclusive features such as performance monitoring to ensure the highest return on investment in React Native development.",
  },
  {
    topic:
      "How does Radon IDE ensure the security of our source code and company data? Does the code leave our environment?",
    answer: `Radon IDE is fundamentally designed to be a local-first tool; all core functionalities, including the simulator, debugger, and inspector, run entirely within your local environment, and your source code is never sent to our servers. The only exception is our optional, user-activated <a href = "/docs/features/radon-ai" target= "_blank">Radon AI</a> and chat features, which send selected code snippets and context to a secure cloud endpoint to provide assistance.`,
  },
  {
    topic:
      "Does Radon AI send fragments of our code to your servers? What data is processed and where?",
    answer:
      "Yes, to provide intelligent assistance, Radon AI features securely transmit selected code snippets and relevant context from your active editor to our servers, which then process the request via third-party LLM providers like OpenAI. This data is used exclusively to generate a response for that specific query and is never stored permanently or used to train any models, ensuring your intellectual property remains completely private.",
  },
  {
    topic: "Is Radon IDE compliant with standards such as SOC 2 or ISO 27001?",
    answer: `Yes, Radon IDE is developed by <a href = "https://swmansion.com/" target = "_blank">Software Mansion</a>, which is an ISO 27001 certified company, meaning our entire organization operates under a certified Information Security Management System (ISMS) that protects your data.`,
  },
  {
    topic: "How does license and user management (seat management) work in the Enterprise plan?",
    answer:
      "The Enterprise plan provides a dedicated administrative dashboard for effortless, centralized control over all your Radon IDE licenses. From this single interface, designated administrators can instantly provision, assign, and revoke access for developers across the entire organization, eliminating the overhead of managing individual subscriptions. This system is built for frictionless scaling, ensuring that as your team grows, you can manage hundreds of seats with minimal administrative effort and maintain a clear overview of license allocation at all times.",
  },
  {
    topic: "Do you offer centralized billing and custom payment terms?",
    answer:
      "Yes, the Enterprise plan is designed to eliminate billing complexity by providing a single, centralized invoice for your entire organization. We work directly with your procurement and finance teams to establish custom payment terms, including support for annual invoicing and purchase orders (POs). Our goal is to make the procurement process as seamless as possible, allowing you to treat Radon IDE as a strategic vendor that adapts to your company's financial workflows.",
  },
  {
    topic: "How does Radon IDE integrate with our internal tools?",
    answer:
      "Radon IDE is built as an extension for VS Code, ensuring seamless compatibility with the vast ecosystem of existing developer tools and any custom extensions your team already uses for its workflow. ",
  },
  {
    topic: "What level of technical support and customer care is offered in the Enterprise plan?",
    answer:
      "Our Enterprise plan provides a premium support experience via a direct, prioritized access to our senior engineers, bypassing first-line support entirely. We formalize this commitment with a Service Level Agreement (SLA) that guarantees rapid response and resolution times for any critical issues that could impact your team's productivity. This transforms our relationship from a simple software vendor to a strategic partner invested in ensuring your team's success and maximizing your ROI with Radon IDE.",
  },
  {
    topic: "Do you offer dedicated onboarding support and training for our teams?",
    answer:
      "Yes, our Enterprise plan includes a dedicated onboarding program tailored to your team's specific workflow, stack, and project goals. Led by our own product experts, these live, hands-on sessions go beyond a simple demo to ensure your developers master advanced features and integrate Radon IDE's best practices from day one. Our objective is to accelerate your team's adoption and guarantee you see a measurable impact on productivity as quickly as possible.",
  },
  {
    topic:
      "What is the process for reporting bugs and requesting new features for Enterprise customers? Do they have higher priority?",
    answer:
      "Absolutely; all feedback from Enterprise customers receives high priority and is routed directly to our core product and engineering teams for expedited review. To facilitate this, we establish a dedicated, private communication channel (such as a shared Slack channel) for your team, ensuring immediate access to our experts for bug reports and feature discussions.",
  },
];
